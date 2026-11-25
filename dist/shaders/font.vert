#version 440 core

layout(location = 0) in vec3 position;
layout(location = 1) in vec2 coord;

mat4 projection = mat4(1.3737387097273113,0.0,0.0,0.0,0.0,1.3737387097273113,0.0,0.0,0.0,0.0,-1.02020202020202,-1.0,0.0,0.0,-2.0202020202020203,0.0);
mat4 camera = mat4(1.0,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,-2.100090086,1.0);
mat4 model = mat4(1.0,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,0.0,1.0);

uniform float offsetX;

out vec2 vCoord;

void main(){

    vec3 pos = position;

    pos.x = pos.x + offsetX;

    gl_Position = projection*camera*model*vec4(pos,1.0);

    vCoord = coord;

}