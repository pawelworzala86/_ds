#version 440 core




uniform sampler2D diffuseTexture;


in vec2 vCoord;



out vec4 color;

void main()
{

	vec3 diffuse = vec3(texture(diffuseTexture, vCoord).rgb);
	
	color = vec4(diffuse, 1.0);

}