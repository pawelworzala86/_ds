#version 440 core




uniform sampler2D diffuseTexture;


in vec2 vCoord;

uniform int fontIndex;

out vec4 color;

void main()
{
	//vec2 coord = vCoord/16.0;

	float gridStep = 1.0/16.0;
    float X = 0.0;
    float Y = 0.0;
    float glyphIndex = float(fontIndex - 1);
    if(glyphIndex >= 0 && glyphIndex < 256){
        X = (mod(glyphIndex, 16.0) + 1.0)*gridStep;
        Y = (floor(glyphIndex / 16.0) + 1.0)*gridStep;
    }


    vec2 coord = vCoord/16.0;

    //coord.x *= float(44.0)/64.0;

    coord += vec2(X,1.0026-Y);

	vec3 diffuse = vec3(texture(diffuseTexture, coord).rgb);
	
	color = vec4(diffuse,1.0);

}