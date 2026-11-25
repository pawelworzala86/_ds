#version 440 core

layout(location = 0) in vec3 position;
layout(location = 1) in vec2 coord;

uniform double offsetX;

out vec2 vCoord;

void main(){

    vec3 pos = position*0.1;

    pos.x = pos.x + float(offsetX);

    gl_Position = vec4(pos,1.0);

    vCoord = coord;

}