#version 440 core

layout(location = 0) in vec3 position;
layout(location = 1) in vec2 coord;

uniform double offsetX;
uniform double offsetY;

uniform double scaleX;
uniform double scaleY;

out vec2 vCoord;

void main(){

    vec3 pos = position;

    pos.x = pos.x * float(scaleX);
    pos.y = pos.y * float(scaleY);

    pos.x = pos.x + float(offsetX);
    pos.y = pos.y + float(offsetY);

    gl_Position = vec4(pos,1.0);

    vCoord = coord;

}