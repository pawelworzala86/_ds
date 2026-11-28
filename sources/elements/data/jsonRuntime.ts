import type Asm from '../../asm.ts'

const registeredAssemblies = new WeakSet<Asm>()

export function ensureJSONRuntime(ASM:Asm){
    if(registeredAssemblies.has(ASM)){
        return
    }
    registeredAssemblies.add(ASM)
    if(ASM.proc.some((procedure:string)=>procedure.includes('proc __ds_json_alloc'))){
        return
    }

    for(const name of ['calloc','free','strlen','memcpy','strcmp','atof','printf']){
        ASM.addImport('msvcrt',name)
    }
    ASM.addImport('kernel32','ExitProcess')
    ASM.addData('__ds_json_literal_null db 110,117,108,108,0')
    ASM.addData('__ds_json_literal_true db 116,114,117,101,0')
    ASM.addData('__ds_json_literal_false db 102,97,108,115,101,0')
    ASM.addData('__ds_json_undefined db 117,110,100,101,102,105,110,101,100,0')
    ASM.addData('__ds_json_type_error_message db 114,117,110,116,105,109,101,32,74,83,79,78,32,116,121,112,101,32,109,105,115,109,97,116,99,104,10,0')

    ASM.addProc(`
proc __ds_json_alloc context,size
sub rsp, 72
mov [rsp+32], rcx
mov [rsp+40], rdx
mov rdx, [rsp+40]
add rdx, 8
mov rcx, 1
call [calloc]
test rax, rax
jz __ds_json_alloc_failed
mov rdx, [rsp+32]
mov r8, [rdx]
mov [rax], r8
mov [rdx], rax
add rax, 8
jmp __ds_json_alloc_done
__ds_json_alloc_failed:
xor rax, rax
__ds_json_alloc_done:
add rsp, 72
ret
endp

proc __ds_json_release_owner context
sub rsp, 56
mov [rsp+32], rcx
mov rax, [rcx]
mov [rsp+40], rax
__ds_json_release_loop:
mov rax, [rsp+40]
test rax, rax
jz __ds_json_release_context
mov rdx, [rax]
mov [rsp+40], rdx
mov rcx, rax
call [free]
jmp __ds_json_release_loop
__ds_json_release_context:
mov rcx, [rsp+32]
call [free]
add rsp, 56
ret
endp

proc __ds_json_free value
test rcx, rcx
jz __ds_json_free_done
mov rcx, [rcx+56]
test rcx, rcx
jz __ds_json_free_done
sub rsp, 40
call __ds_json_release_owner
add rsp, 40
__ds_json_free_done:
ret
endp

proc __ds_json_new_node context,tag,start,end
sub rsp, 72
mov [rsp+32], rcx
mov [rsp+40], rdx
mov [rsp+48], r8
mov [rsp+56], r9
mov rdx, 80
mov rcx, [rsp+32]
call __ds_json_alloc
test rax, rax
jz __ds_json_new_node_done
mov rdx, [rsp+40]
mov [rax], rdx
mov rdx, [rsp+32]
mov [rax+56], rdx
mov rdx, [rsp+48]
mov [rax+64], rdx
mov rdx, [rsp+56]
mov [rax+72], rdx
__ds_json_new_node_done:
add rsp, 72
ret
endp

proc __ds_json_skip_ws context
mov rdx, [rcx+24]
__ds_json_skip_ws_loop:
cmp rdx, [rcx+16]
jnb __ds_json_skip_ws_done
mov r8, [rcx+8]
add r8, rdx
movzx eax, byte [r8]
mov r9b, 32
cmp al, r9b
je __ds_json_skip_ws_next
mov r9b, 9
cmp al, r9b
je __ds_json_skip_ws_next
mov r9b, 10
cmp al, r9b
je __ds_json_skip_ws_next
mov r9b, 13
cmp al, r9b
jne __ds_json_skip_ws_done
__ds_json_skip_ws_next:
inc rdx
jmp __ds_json_skip_ws_loop
__ds_json_skip_ws_done:
mov [rcx+24], rdx
ret
endp

proc __ds_json_match_literal context,literal,length
sub rsp, 72
mov [rsp+32], rcx
mov [rsp+40], rdx
mov [rsp+48], r8
mov rax, [rcx+24]
mov [rsp+56], rax
add rax, r8
cmp rax, [rcx+16]
ja __ds_json_match_literal_no
mov qword [rsp+64], 0
__ds_json_match_literal_loop:
mov rax, [rsp+64]
cmp rax, [rsp+48]
jnb __ds_json_match_literal_yes
mov rdx, [rsp+32]
mov rdx, [rdx+8]
add rdx, [rsp+56]
add rdx, rax
movzx ecx, byte [rdx]
mov rdx, [rsp+40]
add rdx, rax
movzx eax, byte [rdx]
cmp ecx, eax
jne __ds_json_match_literal_no
inc qword [rsp+64]
jmp __ds_json_match_literal_loop
__ds_json_match_literal_yes:
mov rdx, [rsp+32]
mov rax, [rsp+56]
add rax, [rsp+48]
mov [rdx+24], rax
mov rax, 1
jmp __ds_json_match_literal_done
__ds_json_match_literal_no:
xor rax, rax
__ds_json_match_literal_done:
add rsp, 72
ret
endp

proc __ds_json_hex_value character
mov eax, ecx
mov r9b, 48
cmp al, r9b
jb __ds_json_hex_upper
mov r9b, 57
cmp al, r9b
ja __ds_json_hex_upper
mov rax, rcx
mov r9, 48
sub rax, r9
ret
__ds_json_hex_upper:
mov r9b, 65
cmp al, r9b
jb __ds_json_hex_lower
mov r9b, 70
cmp al, r9b
ja __ds_json_hex_lower
mov rax, rcx
mov r9, 55
sub rax, r9
ret
__ds_json_hex_lower:
mov r9b, 97
cmp al, r9b
jb __ds_json_hex_bad
mov r9b, 102
cmp al, r9b
ja __ds_json_hex_bad
mov rax, rcx
mov r9, 87
sub rax, r9
ret
__ds_json_hex_bad:
mov rax, -1
ret
endp

proc __ds_json_parse_string context
sub rsp, 104
mov [rsp+32], rcx
mov rcx, [rsp+32]
mov rax, [rcx+24]
mov [rsp+40], rax
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 34
cmp al, r9b
jne __ds_json_parse_string_fail
inc qword [rsp+40]
mov rdx, [rcx+16]
sub rdx, [rcx+24]
inc rdx
mov rcx, [rsp+32]
call __ds_json_alloc
test rax, rax
jz __ds_json_parse_string_fail
mov [rsp+48], rax
mov [rsp+56], rax
mov qword [rsp+64], 0
__ds_json_parse_string_loop:
mov rax, [rsp+40]
mov rcx, [rsp+32]
cmp rax, [rcx+16]
jnb __ds_json_parse_string_fail
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 34
cmp al, r9b
je __ds_json_parse_string_end
mov r9b, 92
cmp al, r9b
je __ds_json_parse_string_escape
mov r9b, 32
cmp al, r9b
jb __ds_json_parse_string_fail
mov rdx, [rsp+56]
mov byte [rdx], al
inc qword [rsp+56]
inc qword [rsp+64]
inc qword [rsp+40]
jmp __ds_json_parse_string_loop
__ds_json_parse_string_escape:
inc qword [rsp+40]
mov rax, [rsp+40]
mov rcx, [rsp+32]
cmp rax, [rcx+16]
jnb __ds_json_parse_string_fail
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 34
cmp al, r9b
je __ds_json_parse_string_copy
mov r9b, 92
cmp al, r9b
je __ds_json_parse_string_copy
mov r9b, 47
cmp al, r9b
je __ds_json_parse_string_copy
mov r9b, 98
cmp al, r9b
je __ds_json_parse_string_backspace
mov r9b, 102
cmp al, r9b
je __ds_json_parse_string_formfeed
mov r9b, 110
cmp al, r9b
je __ds_json_parse_string_newline
mov r9b, 114
cmp al, r9b
je __ds_json_parse_string_return
mov r9b, 116
cmp al, r9b
je __ds_json_parse_string_tab
mov r9b, 117
cmp al, r9b
je __ds_json_parse_string_unicode
jmp __ds_json_parse_string_fail
__ds_json_parse_string_backspace:
mov al, 8
jmp __ds_json_parse_string_write_escape
__ds_json_parse_string_formfeed:
mov al, 12
jmp __ds_json_parse_string_write_escape
__ds_json_parse_string_newline:
mov al, 10
jmp __ds_json_parse_string_write_escape
__ds_json_parse_string_return:
mov al, 13
jmp __ds_json_parse_string_write_escape
__ds_json_parse_string_tab:
mov al, 9
jmp __ds_json_parse_string_write_escape
__ds_json_parse_string_copy:
__ds_json_parse_string_write_escape:
mov rdx, [rsp+56]
mov byte [rdx], al
inc qword [rsp+56]
inc qword [rsp+64]
inc qword [rsp+40]
jmp __ds_json_parse_string_loop
__ds_json_parse_string_unicode:
inc qword [rsp+40]
mov qword [rsp+72], 0
mov qword [rsp+80], 0
__ds_json_parse_string_unicode_loop:
mov rax, [rsp+40]
mov rcx, [rsp+32]
cmp rax, [rcx+16]
jnb __ds_json_parse_string_fail
mov rdx, [rcx+8]
add rdx, rax
movzx ecx, byte [rdx]
call __ds_json_hex_value
test rax, rax
js __ds_json_parse_string_fail
shl qword [rsp+72], 4
add qword [rsp+72], rax
inc qword [rsp+40]
inc qword [rsp+80]
cmp qword [rsp+80], 4
jb __ds_json_parse_string_unicode_loop
mov rax, [rsp+72]
mov r9d, 127
cmp eax, r9d
ja __ds_json_parse_string_unicode_multibyte
mov rdx, [rsp+56]
mov byte [rdx], al
inc qword [rsp+56]
inc qword [rsp+64]
jmp __ds_json_parse_string_loop
__ds_json_parse_string_unicode_multibyte:
mov r9d, 2047
cmp eax, r9d
ja __ds_json_parse_string_unicode_three
mov rdx, rax
shr rdx, 6
mov r9d, 192
add edx, r9d
mov rcx, [rsp+56]
mov byte [rcx], dl
inc rcx
mov byte [rcx], al
and byte [rcx], 63
or byte [rcx], 128
add qword [rsp+56], 2
add qword [rsp+64], 2
jmp __ds_json_parse_string_loop
__ds_json_parse_string_unicode_three:
mov rdx, rax
shr rdx, 12
mov r9d, 224
add edx, r9d
mov rcx, [rsp+56]
mov byte [rcx], dl
inc rcx
mov rdx, rax
shr rdx, 6
mov byte [rcx], dl
and byte [rcx], 63
or byte [rcx], 128
inc rcx
mov byte [rcx], al
and byte [rcx], 63
or byte [rcx], 128
add qword [rsp+56], 3
add qword [rsp+64], 3
jmp __ds_json_parse_string_loop
__ds_json_parse_string_end:
mov rdx, [rsp+56]
mov byte [rdx], 0
inc qword [rsp+40]
mov rcx, [rsp+32]
mov rdx, [rsp+40]
mov [rcx+24], rdx
mov rax, [rsp+48]
jmp __ds_json_parse_string_done
__ds_json_parse_string_fail:
mov rcx, [rsp+32]
mov qword [rcx+32], 1
xor rax, rax
__ds_json_parse_string_done:
add rsp, 104
ret
endp

proc __ds_json_parse_number context,start
sub rsp, 104
mov [rsp+32], rcx
mov [rsp+40], rdx
mov [rsp+48], rdx
mov rax, [rcx+8]
add rax, rdx
movzx eax, byte [rax]
mov r9b, 45
cmp al, r9b
jne __ds_json_number_integer
inc qword [rsp+48]
__ds_json_number_integer:
mov rax, [rsp+48]
mov rcx, [rsp+32]
cmp rax, [rcx+16]
jnb __ds_json_number_fail
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 48
cmp al, r9b
jb __ds_json_number_nonzero
mov r9b, 57
cmp al, r9b
ja __ds_json_number_fail
mov r9b, 48
cmp al, r9b
jne __ds_json_number_integer_digits
inc qword [rsp+48]
mov rax, [rsp+48]
cmp rax, [rcx+16]
jnb __ds_json_number_fraction
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 48
cmp al, r9b
jb __ds_json_number_fraction
mov r9b, 57
cmp al, r9b
jbe __ds_json_number_fail
jmp __ds_json_number_fraction
__ds_json_number_nonzero:
mov r9b, 49
cmp al, r9b
jb __ds_json_number_fail
mov r9b, 57
cmp al, r9b
ja __ds_json_number_fail
__ds_json_number_integer_digits:
inc qword [rsp+48]
__ds_json_number_integer_loop:
mov rax, [rsp+48]
mov rcx, [rsp+32]
cmp rax, [rcx+16]
jnb __ds_json_number_fraction
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 48
cmp al, r9b
jb __ds_json_number_fraction
mov r9b, 57
cmp al, r9b
ja __ds_json_number_fraction
inc qword [rsp+48]
jmp __ds_json_number_integer_loop
__ds_json_number_fraction:
mov rax, [rsp+48]
mov rcx, [rsp+32]
cmp rax, [rcx+16]
jnb __ds_json_number_finish
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 46
cmp al, r9b
jne __ds_json_number_exponent
inc qword [rsp+48]
mov rax, [rsp+48]
cmp rax, [rcx+16]
jnb __ds_json_number_fail
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 48
cmp al, r9b
jb __ds_json_number_fail
mov r9b, 57
cmp al, r9b
ja __ds_json_number_fail
inc qword [rsp+48]
__ds_json_number_fraction_loop:
mov rax, [rsp+48]
mov rcx, [rsp+32]
cmp rax, [rcx+16]
jnb __ds_json_number_finish
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 48
cmp al, r9b
jb __ds_json_number_exponent
mov r9b, 57
cmp al, r9b
ja __ds_json_number_exponent
inc qword [rsp+48]
jmp __ds_json_number_fraction_loop
__ds_json_number_exponent:
mov rax, [rsp+48]
mov rcx, [rsp+32]
cmp rax, [rcx+16]
jnb __ds_json_number_finish
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 69
cmp al, r9b
je __ds_json_number_exponent_start
mov r9b, 101
cmp al, r9b
jne __ds_json_number_finish
__ds_json_number_exponent_start:
inc qword [rsp+48]
mov rax, [rsp+48]
cmp rax, [rcx+16]
jnb __ds_json_number_fail
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 43
cmp al, r9b
je __ds_json_number_exponent_sign
mov r9b, 45
cmp al, r9b
jne __ds_json_number_exponent_digit
__ds_json_number_exponent_sign:
inc qword [rsp+48]
mov rax, [rsp+48]
cmp rax, [rcx+16]
jnb __ds_json_number_fail
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
__ds_json_number_exponent_digit:
mov r9b, 48
cmp al, r9b
jb __ds_json_number_fail
mov r9b, 57
cmp al, r9b
ja __ds_json_number_fail
inc qword [rsp+48]
__ds_json_number_exponent_loop:
mov rax, [rsp+48]
mov rcx, [rsp+32]
cmp rax, [rcx+16]
jnb __ds_json_number_finish
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 48
cmp al, r9b
jb __ds_json_number_finish
mov r9b, 57
cmp al, r9b
ja __ds_json_number_finish
inc qword [rsp+48]
jmp __ds_json_number_exponent_loop
__ds_json_number_finish:
mov rcx, [rsp+32]
mov rdx, [rsp+48]
mov [rcx+24], rdx
mov r8, [rsp+40]
mov r9, rdx
mov rdx, 3
call __ds_json_new_node
test rax, rax
jz __ds_json_number_fail
mov [rsp+56], rax
mov rdx, [rsp+32]
mov rdx, [rdx+8]
add rdx, [rsp+40]
mov rcx, rdx
call [atof]
mov rax, [rsp+56]
movsd qword [rax+8], xmm0
mov rax, [rsp+56]
jmp __ds_json_number_done
__ds_json_number_fail:
mov rcx, [rsp+32]
mov qword [rcx+32], 1
xor rax, rax
__ds_json_number_done:
add rsp, 104
ret
endp

proc __ds_json_parse_object context,start
sub rsp, 104
mov [rsp+32], rcx
mov [rsp+40], rdx
mov rcx, [rsp+32]
mov rdx, 6
mov r8, [rsp+40]
mov r9, 0
call __ds_json_new_node
test rax, rax
jz __ds_json_object_fail
mov [rsp+48], rax
mov rax, [rsp+48]
__ds_json_object_loop:
mov rcx, [rsp+32]
call __ds_json_skip_ws
mov rcx, [rsp+32]
mov rax, [rcx+24]
cmp rax, [rcx+16]
jnb __ds_json_object_fail
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 125
cmp al, r9b
je __ds_json_object_close
mov r9b, 34
cmp al, r9b
jne __ds_json_object_fail
mov rcx, [rsp+32]
call __ds_json_parse_string
test rax, rax
jz __ds_json_object_fail
mov [rsp+56], rax
mov rcx, [rsp+32]
call __ds_json_skip_ws
mov rcx, [rsp+32]
mov rax, [rcx+24]
cmp rax, [rcx+16]
jnb __ds_json_object_fail
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 58
cmp al, r9b
jne __ds_json_object_fail
inc qword [rcx+24]
mov rcx, [rsp+32]
call __ds_json_parse_value
test rax, rax
jz __ds_json_object_fail
mov [rsp+64], rax
mov rdx, [rsp+56]
mov [rax+48], rdx
mov rdx, [rsp+48]
mov rcx, [rdx+32]
test rcx, rcx
jz __ds_json_object_first
mov rax, [rsp+64]
mov [rcx+40], rax
jmp __ds_json_object_append
__ds_json_object_first:
mov rax, [rsp+64]
mov [rdx+24], rax
__ds_json_object_append:
mov rax, [rsp+64]
mov [rdx+32], rax
inc qword [rdx+16]
mov rcx, [rsp+32]
call __ds_json_skip_ws
mov rcx, [rsp+32]
mov rax, [rcx+24]
cmp rax, [rcx+16]
jnb __ds_json_object_fail
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 44
cmp al, r9b
je __ds_json_object_comma
mov r9b, 125
cmp al, r9b
jne __ds_json_object_fail
__ds_json_object_close:
mov rcx, [rsp+32]
inc qword [rcx+24]
mov rax, [rcx+24]
mov rdx, [rsp+48]
mov [rdx+72], rax
mov rax, rdx
jmp __ds_json_object_done
__ds_json_object_comma:
inc qword [rcx+24]
jmp __ds_json_object_loop
__ds_json_object_fail:
mov rcx, [rsp+32]
mov qword [rcx+32], 1
xor rax, rax
__ds_json_object_done:
add rsp, 104
ret
endp

proc __ds_json_parse_array context,start
sub rsp, 104
mov [rsp+32], rcx
mov [rsp+40], rdx
mov rdx, 5
mov r8, [rsp+40]
mov r9, 0
call __ds_json_new_node
test rax, rax
jz __ds_json_array_fail
mov [rsp+48], rax
__ds_json_array_loop:
mov rcx, [rsp+32]
call __ds_json_skip_ws
mov rcx, [rsp+32]
mov rax, [rcx+24]
cmp rax, [rcx+16]
jnb __ds_json_array_fail
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 93
cmp al, r9b
je __ds_json_array_close
mov rcx, [rsp+32]
call __ds_json_parse_value
test rax, rax
jz __ds_json_array_fail
mov [rsp+64], rax
mov rdx, [rsp+48]
mov rcx, [rdx+32]
test rcx, rcx
jz __ds_json_array_first
mov rax, [rsp+64]
mov [rcx+40], rax
jmp __ds_json_array_append
__ds_json_array_first:
mov rax, [rsp+64]
mov [rdx+24], rax
__ds_json_array_append:
mov rax, [rsp+64]
mov [rdx+32], rax
inc qword [rdx+16]
mov rcx, [rsp+32]
call __ds_json_skip_ws
mov rcx, [rsp+32]
mov rax, [rcx+24]
cmp rax, [rcx+16]
jnb __ds_json_array_fail
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 44
cmp al, r9b
je __ds_json_array_comma
mov r9b, 93
cmp al, r9b
jne __ds_json_array_fail
__ds_json_array_close:
mov rcx, [rsp+32]
inc qword [rcx+24]
mov rax, [rcx+24]
mov rdx, [rsp+48]
mov [rdx+72], rax
mov rax, rdx
jmp __ds_json_array_done
__ds_json_array_comma:
inc qword [rcx+24]
jmp __ds_json_array_loop
__ds_json_array_fail:
mov rcx, [rsp+32]
mov qword [rcx+32], 1
xor rax, rax
__ds_json_array_done:
add rsp, 104
ret
endp

proc __ds_json_parse_value context
sub rsp, 104
mov [rsp+32], rcx
mov rdx, [rcx+40]
inc rdx
mov [rcx+40], rdx
mov r9, 256
cmp rdx, r9
ja __ds_json_value_fail
mov rcx, [rsp+32]
call __ds_json_skip_ws
mov rcx, [rsp+32]
mov rax, [rcx+24]
mov [rsp+40], rax
cmp rax, [rcx+16]
jnb __ds_json_value_fail
mov rdx, [rcx+8]
add rdx, rax
movzx eax, byte [rdx]
mov r9b, 123
cmp al, r9b
je __ds_json_value_object
mov r9b, 91
cmp al, r9b
je __ds_json_value_array
mov r9b, 34
cmp al, r9b
je __ds_json_value_string
mov r9b, 110
cmp al, r9b
je __ds_json_value_null
mov r9b, 116
cmp al, r9b
je __ds_json_value_true
mov r9b, 102
cmp al, r9b
je __ds_json_value_false
mov rcx, [rsp+32]
mov rdx, [rsp+40]
call __ds_json_parse_number
jmp __ds_json_value_done
__ds_json_value_object:
mov rcx, [rsp+32]
inc qword [rcx+24]
mov rcx, [rsp+32]
mov rdx, [rsp+40]
call __ds_json_parse_object
jmp __ds_json_value_done
__ds_json_value_array:
inc qword [rcx+24]
mov rcx, [rsp+32]
mov rdx, [rsp+40]
call __ds_json_parse_array
jmp __ds_json_value_done
__ds_json_value_string:
mov rcx, [rsp+32]
call __ds_json_parse_string
test rax, rax
jz __ds_json_value_fail
mov [rsp+48], rax
mov rcx, [rsp+32]
mov rdx, 4
mov r8, [rsp+40]
mov r9, [rcx+24]
call __ds_json_new_node
test rax, rax
jz __ds_json_value_fail
mov [rsp+56], rax
mov rdx, [rsp+48]
mov [rax+8], rdx
mov rdx, [rsp+56]
mov rax, [rdx+72]
sub rax, [rdx+64]
sub rax, 2
mov [rdx+16], rax
mov rax, rdx
jmp __ds_json_value_done
__ds_json_value_null:
mov rcx, [rsp+32]
lea rdx, [__ds_json_literal_null]
mov r8, 4
call __ds_json_match_literal
test rax, rax
jz __ds_json_value_fail
mov rcx, [rsp+32]
mov rdx, 1
mov r8, [rsp+40]
mov r9, [rcx+24]
call __ds_json_new_node
jmp __ds_json_value_done
__ds_json_value_true:
mov rcx, [rsp+32]
lea rdx, [__ds_json_literal_true]
mov r8, 4
call __ds_json_match_literal
test rax, rax
jz __ds_json_value_fail
mov rcx, [rsp+32]
mov rdx, 2
mov r8, [rsp+40]
mov r9, [rcx+24]
call __ds_json_new_node
test rax, rax
jz __ds_json_value_fail
mov qword [rax+8], 1
jmp __ds_json_value_done
__ds_json_value_false:
mov rcx, [rsp+32]
lea rdx, [__ds_json_literal_false]
mov r8, 5
call __ds_json_match_literal
test rax, rax
jz __ds_json_value_fail
mov rcx, [rsp+32]
mov rdx, 2
mov r8, [rsp+40]
mov r9, [rcx+24]
call __ds_json_new_node
jmp __ds_json_value_done
__ds_json_value_fail:
mov rcx, [rsp+32]
mov qword [rcx+32], 1
xor rax, rax
__ds_json_value_done:
mov rcx, [rsp+32]
dec qword [rcx+40]
add rsp, 104
ret
endp

proc __ds_json_parse input
sub rsp, 104
mov [rsp+32], rcx
mov rcx, [rsp+32]
call [strlen]
mov [rsp+40], rax
mov rcx, 1
mov rdx, 48
call [calloc]
test rax, rax
jz __ds_json_parse_done
mov [rsp+48], rax
mov rcx, [rsp+48]
mov rdx, [rsp+40]
inc rdx
call __ds_json_alloc
test rax, rax
jz __ds_json_parse_fail
mov [rsp+56], rax
mov rcx, [rsp+56]
mov rdx, [rsp+32]
mov r8, [rsp+40]
inc r8
call [memcpy]
mov rdx, [rsp+48]
mov rax, [rsp+56]
mov [rdx+8], rax
mov rax, [rsp+40]
mov [rdx+16], rax
mov qword [rdx+24], 0
mov qword [rdx+32], 0
mov rcx, rdx
call __ds_json_parse_value
test rax, rax
jz __ds_json_parse_fail
mov [rsp+64], rax
mov rcx, [rsp+48]
call __ds_json_skip_ws
mov rcx, [rsp+48]
mov rax, [rcx+24]
cmp rax, [rcx+16]
jne __ds_json_parse_fail
mov rax, [rsp+64]
jmp __ds_json_parse_done
__ds_json_parse_fail:
mov rcx, [rsp+48]
call __ds_json_release_owner
xor rax, rax
__ds_json_parse_done:
add rsp, 104
ret
endp

proc __ds_json_get_property node,key
sub rsp, 72
mov [rsp+32], rcx
mov [rsp+40], rdx
test rcx, rcx
jz __ds_json_property_missing
cmp qword [rcx], 6
jne __ds_json_property_missing
mov rax, [rcx+24]
mov [rsp+48], rax
__ds_json_property_loop:
mov rax, [rsp+48]
test rax, rax
jz __ds_json_property_missing
mov rdx, [rax+48]
test rdx, rdx
jz __ds_json_property_next
mov rcx, rdx
mov rdx, [rsp+40]
call [strcmp]
test eax, eax
jz __ds_json_property_found
__ds_json_property_next:
mov rax, [rsp+48]
mov rax, [rax+40]
mov [rsp+48], rax
jmp __ds_json_property_loop
__ds_json_property_found:
mov rax, [rsp+48]
jmp __ds_json_property_done
__ds_json_property_missing:
xor rax, rax
__ds_json_property_done:
add rsp, 72
ret
endp

proc __ds_json_get_index node,index
test rcx, rcx
jz __ds_json_index_missing
cmp qword [rcx], 5
jne __ds_json_index_missing
test rdx, rdx
js __ds_json_index_missing
cmp rdx, [rcx+16]
jnb __ds_json_index_missing
mov rax, [rcx+24]
__ds_json_index_loop:
test rdx, rdx
jz __ds_json_index_done
mov rax, [rax+40]
dec rdx
jmp __ds_json_index_loop
__ds_json_index_done:
ret
__ds_json_index_missing:
xor rax, rax
ret
endp

proc __ds_json_to_string node
test rcx, rcx
jz __ds_json_type_error
cmp qword [rcx], 4
jne __ds_json_type_error
mov rax, [rcx+8]
ret
endp

proc __ds_json_to_number node
test rcx, rcx
jz __ds_json_type_error
cmp qword [rcx], 3
jne __ds_json_type_error
movsd xmm0, qword [rcx+8]
ret
endp

proc __ds_json_to_boolean node
test rcx, rcx
jz __ds_json_type_error
cmp qword [rcx], 2
jne __ds_json_type_error
mov rax, [rcx+8]
ret
endp

proc __ds_json_stringify node
sub rsp, 104
mov [rsp+32], rcx
test rcx, rcx
jz __ds_json_stringify_undefined
mov rdx, [rcx+56]
mov [rsp+40], rdx
mov rax, [rcx+72]
sub rax, [rcx+64]
mov [rsp+48], rax
mov rdx, [rdx+8]
add rdx, [rcx+64]
mov [rsp+56], rdx
mov rcx, [rsp+40]
lea rdx, [rax+1]
call __ds_json_alloc
test rax, rax
jz __ds_json_stringify_undefined
mov [rsp+64], rax
mov qword [rsp+72], 0
mov qword [rsp+80], 0
mov qword [rsp+88], 0
mov qword [rsp+96], 0
__ds_json_stringify_loop:
mov rax, [rsp+72]
cmp rax, [rsp+48]
jnb __ds_json_stringify_end
mov rdx, [rsp+56]
add rdx, rax
movzx ecx, byte [rdx]
mov rax, [rsp+88]
test rax, rax
jz __ds_json_stringify_outside
mov rdx, [rsp+64]
add rdx, [rsp+80]
mov byte [rdx], cl
inc qword [rsp+80]
mov rax, [rsp+96]
test rax, rax
jz __ds_json_stringify_inside_unescaped
mov qword [rsp+96], 0
jmp __ds_json_stringify_next
__ds_json_stringify_inside_unescaped:
mov r9b, 92
cmp cl, r9b
jne __ds_json_stringify_check_quote
mov qword [rsp+96], 1
jmp __ds_json_stringify_next
__ds_json_stringify_check_quote:
mov r9b, 34
cmp cl, r9b
jne __ds_json_stringify_next
mov qword [rsp+88], 0
jmp __ds_json_stringify_next
__ds_json_stringify_outside:
mov r9b, 34
cmp cl, r9b
jne __ds_json_stringify_check_space
mov qword [rsp+88], 1
jmp __ds_json_stringify_write
__ds_json_stringify_check_space:
mov r9b, 32
cmp cl, r9b
je __ds_json_stringify_next
mov r9b, 9
cmp cl, r9b
je __ds_json_stringify_next
mov r9b, 10
cmp cl, r9b
je __ds_json_stringify_next
mov r9b, 13
cmp cl, r9b
je __ds_json_stringify_next
__ds_json_stringify_write:
mov rdx, [rsp+64]
add rdx, [rsp+80]
mov byte [rdx], cl
inc qword [rsp+80]
__ds_json_stringify_next:
inc qword [rsp+72]
jmp __ds_json_stringify_loop
__ds_json_stringify_end:
mov rax, [rsp+64]
add rax, [rsp+80]
mov byte [rax], 0
mov rax, [rsp+64]
jmp __ds_json_stringify_done
__ds_json_stringify_undefined:
lea rax, [__ds_json_undefined]
__ds_json_stringify_done:
add rsp, 104
ret
endp

proc __ds_json_from_string value
sub rsp, 104
mov [rsp+32], rcx
call [strlen]
mov [rsp+40], rax
lea rcx, [rax+rax*2]
shl rcx, 1
add rcx, 3
call [malloc]
test rax, rax
jz __ds_json_from_string_done
mov [rsp+48], rax
mov byte [rax], 34
mov qword [rsp+56], 1
mov qword [rsp+64], 0
__ds_json_from_string_loop:
mov rax, [rsp+64]
cmp rax, [rsp+40]
jnb __ds_json_from_string_end
mov rdx, [rsp+32]
add rdx, rax
movzx ecx, byte [rdx]
mov r9b, 34
cmp cl, r9b
je __ds_json_from_string_escape
mov r9b, 92
cmp cl, r9b
je __ds_json_from_string_escape
mov r9b, 8
cmp cl, r9b
je __ds_json_from_string_control
mov r9b, 9
cmp cl, r9b
je __ds_json_from_string_control
mov r9b, 10
cmp cl, r9b
je __ds_json_from_string_control
mov r9b, 12
cmp cl, r9b
je __ds_json_from_string_control
mov r9b, 13
cmp cl, r9b
je __ds_json_from_string_control
mov r9b, 32
cmp cl, r9b
jb __ds_json_from_string_control
mov rdx, [rsp+48]
add rdx, [rsp+56]
mov byte [rdx], cl
inc qword [rsp+56]
jmp __ds_json_from_string_next
__ds_json_from_string_escape:
mov rdx, [rsp+48]
add rdx, [rsp+56]
mov byte [rdx], 92
inc qword [rsp+56]
mov rax, [rsp+64]
mov rdx, [rsp+32]
add rdx, rax
mov cl, byte [rdx]
mov rdx, [rsp+48]
add rdx, [rsp+56]
mov byte [rdx], cl
inc qword [rsp+56]
jmp __ds_json_from_string_next
__ds_json_from_string_control:
mov rdx, [rsp+48]
add rdx, [rsp+56]
mov byte [rdx], 92
mov byte [rdx+1], 117
mov byte [rdx+2], 48
mov byte [rdx+3], 48
mov rax, [rsp+64]
mov rcx, [rsp+32]
mov rdx, rcx
add rdx, rax
movzx ecx, byte [rdx]
mov rax, rcx
shr eax, 4
mov r9b, 10
cmp al, r9b
jb __ds_json_from_string_high_digit
mov r9b, 87
add al, r9b
jmp __ds_json_from_string_high_ready
__ds_json_from_string_high_digit:
mov r9b, 48
add al, r9b
__ds_json_from_string_high_ready:
mov rdx, [rsp+48]
add rdx, [rsp+56]
mov byte [rdx+4], al
mov rax, rcx
shr rax, 4
shl rax, 4
sub rcx, rax
mov eax, ecx
mov r9b, 10
cmp al, r9b
jb __ds_json_from_string_low_digit
mov r9b, 87
add al, r9b
jmp __ds_json_from_string_low_ready
__ds_json_from_string_low_digit:
mov r9b, 48
add al, r9b
__ds_json_from_string_low_ready:
mov rdx, [rsp+48]
add rdx, [rsp+56]
mov byte [rdx+5], al
add qword [rsp+56], 6
__ds_json_from_string_next:
inc qword [rsp+64]
jmp __ds_json_from_string_loop
__ds_json_from_string_end:
mov rax, [rsp+48]
mov rdx, [rsp+56]
mov r8, rax
add rax, rdx
mov byte [rax], 34
mov byte [rax+1], 0
mov rcx, r8
call __ds_json_parse
mov [rsp+72], rax
mov rcx, [rsp+48]
call [free]
mov rax, [rsp+72]
__ds_json_from_string_done:
add rsp, 104
ret
endp

proc __ds_json_is_valid value
test rcx, rcx
jnz __ds_json_is_valid_true
xor rax, rax
ret
__ds_json_is_valid_true:
mov rax, 1
ret
endp

proc __ds_json_type_error
sub rsp, 40
lea rcx, [__ds_json_type_error_message]
call [printf]
mov ecx, 1
call [ExitProcess]
add rsp, 40
xor rax, rax
ret
endp
`)
}
