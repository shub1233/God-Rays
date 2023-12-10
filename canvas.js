let canvas = null;
let gl = null;
let canvas_original_width;
let canvas_original_height;
let bfullScreen = false;
let angleCube = 0.0;
let FBO_WIDTH = 1024;
let FBO_HEIGHT = 1025;

const webGLMacros = {
    SSS_ATTRIBUTE_POSITION: 0,
    SSS_ATTRIBUTE_NORMAL: 1,
    SSS_ATTRIBUTE_TEXTURE0: 2,
    SSS_ATTRIBUTE_COLOR: 3,
};

let vao_cube;
let vbo_cube_vertice;
let vbo_cube_texcoord;
let vbo_cube_normal;

let vao_quad;
let vbo_quad_vertices;
let vbo_quad_texcoord;

/****** fbo's */
let fbo_pass_one;
let rbo_pass_one;
let fbo_pass_one_texture;
let b_fbo_pass_one_result = false;

let fbo_pass_two;
let rbo_pass_two;
let fbo_pass_two_texture;
let b_fbo_pass_two_result = false;

let fbo_pass_three;
let rbo_pass_three;
let fbo_pass_three_texture;
let b_fbo_pass_three_result = false;
/***************************** */

let texture_depth;

// ****** uniforms *******
let modelMatrixUniform;
let viewMatrixUniform;
let projectionMatrixUniform;

let modelMatrixUniform_passthrough;
let viewMatrixUniform_passthrough;
let projectionMatrixUniform_passthrough;

let colorUniform_passthrought;

let modelMatrixUniform_texture;
let viewMatrixUniform_texture;
let projectionMatrixUniform_texture;
let textureSamplerUniform_texture0;

let modelMatrixUniform_final;
let viewMatrixUniform_final;
let projectionMatrixUniform_final;
let textureSamplerUniform_final0;
let textureSamplerUniform_final1;

let colorUniform;
let exposureUniform;
let decayUniform;
let densityUniform;
let weightUniform;
let lightPositionOnScreenUniform;
let myTextureUniform;
/***********************************/

let perspectiveProjectionMatrix;

let shaderProgramObject;
let shaderProgramObject_passthrough;
let shaderProgramObject_texture;
let shaderProgramObject_final;

let translateX = -1.0;
let translateY = 2.0;
let translateZ = -6.0;

let requestAnimationFrame = window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame;

const settings = {
    exposure: 0.3397,
    decay: 0.82,
    density: 0.16,
    weight: 22.22,
    lPosX: 0.0,
    lPosY: 0.0,
};

function main() {
    canvas = document.getElementById("sss");

    // Get canvas
    if (!canvas) {
        console.log('Obtaining canvas failed!!!');
    } else {
        console.log('Obtaining canvas successful!!!');
    }

    // Backup Canvas dimensions
    canvas_original_width = canvas.width;
    canvas_original_height = canvas.height;

    // Initialize
    initialize();

    // Warm-up Resize
    resize();

    // Display :- You cannot give render loop in webGL
    display();

    //Add/Handling event listener.
    window.addEventListener("keydown", keyDown, false /*capture parameter false: do not capture send it upwards i.e event bubbling (David Flanagan) */);
    window.addEventListener("click", mouseDown, false /*capture parameter false: do not capture send it upwards i.e event bubbling (David Flanagan) */);
    window.addEventListener("resize", resize, false);
}


function toggleFullscreen() {
    // code
    let fullScreenElement = document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement ||
        null;

    if (fullScreenElement == null) {
        if (canvas.requestFullscreen) {
            canvas.requestFullscreen();
        } else if (canvas.mozRequestFullScreen) {
            canvas.mozRequestFullScreen();
        } else if (canvas.webkitRequestFullscreen) {
            canvas.webkitRequestFullscreen();
        } else if (canvas.msRequestFullscreen) {
            canvas.msRequestFullscreen();
        }

        bfullScreen = true;
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.moxExitFullScreen) {
            document.moxExitFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }

        bfullScreen = false;
    }
}

function normalShaderOperations() {
    // Vertex Shader
    const vertexShaderSourceCode = `#version 300 es
    in vec4 a_position;
    in vec2 a_texcoord;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;

    out vec2 a_texcoord_out;

    void main() {
        a_texcoord_out = a_texcoord;
        gl_Position = a_position;
    }
    `;

    let vertexShaderObject = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShaderObject, vertexShaderSourceCode);
    gl.compileShader(vertexShaderObject);

    if (gl.getShaderParameter(vertexShaderObject, gl.COMPILE_STATUS) === false) {
        let error = gl.getShaderInfoLog(vertexShaderObject);
        if (error.length) {
            alert("SSS: Vertex Shader Compilation Log: " + error);
            uninitialize();
        }
    }

    // Fragment Shader
    const fragmentShaderSourceCode = `#version 300 es
    precision highp float;

    uniform float u_exposure;
    uniform float u_decay;
    uniform float u_density;
    uniform float u_weight;
    uniform vec2 u_lightPositionOnScreen;
    uniform sampler2D u_textureSampler;
    uniform vec4 u_color;

    const int NUM_SAMPLES = 100;

    in vec2 a_texcoord_out;
    out vec4 fragColor;

    void main() {
        vec2 deltaTextCoord = vec2(a_texcoord_out.xy - u_lightPositionOnScreen.xy);
        vec2 textCoo = a_texcoord_out.xy;

        deltaTextCoord *= 1.0 / float(NUM_SAMPLES) * u_density;
        float illuminationDecay = 1.0;

        // fragColor = vec4(0.0);

        for(int i = 0; i < NUM_SAMPLES; i++) {
            textCoo -= deltaTextCoord;
            vec4 sampl = texture(u_textureSampler, textCoo);
            sampl *= illuminationDecay * u_weight;
            fragColor += sampl;
            illuminationDecay *= u_decay;
        }

        // fragColor = u_color;
        fragColor *= u_exposure;
        // fragColor *= vec4(0.0, 1.0, 0.0, 1.0);
    }
    `;

    let fragmentShaderObject = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShaderObject, fragmentShaderSourceCode);
    gl.compileShader(fragmentShaderObject);

    if (
        gl.getShaderParameter(fragmentShaderObject, gl.COMPILE_STATUS) === false
    ) {
        let error = gl.getShaderInfoLog(fragmentShaderObject);
        if (error.length) {
            alert("SSS: Fragment Shader Compilation Log: " + error);
            uninitialize();
        }
    }

    // Shader Program
    shaderProgramObject = gl.createProgram();

    gl.attachShader(shaderProgramObject, vertexShaderObject);
    gl.attachShader(shaderProgramObject, fragmentShaderObject);

    // Pre-linking
    gl.bindAttribLocation(
        shaderProgramObject,
        webGLMacros.SSS_ATTRIBUTE_POSITION,
        "a_position"
    );

    gl.bindAttribLocation(
        shaderProgramObject,
        webGLMacros.SSS_ATTRIBUTE_TEXTURE0,
        "a_texcoord"
    );

    // linking
    gl.linkProgram(shaderProgramObject);

    // link error checking
    if (gl.getProgramParameter(shaderProgramObject, gl.LINK_STATUS) === false) {
        let error = gl.getProgramInfoLog(shaderProgramObject);
        if (error.length) {
            alert("SSS: Shader Program Linking Log: " + error);
            uninitialize();
        }
    }

    // fetch uniform locations
    modelMatrixUniform = gl.getUniformLocation(
        shaderProgramObject,
        "u_modelMatrix"
    );
    viewMatrixUniform = gl.getUniformLocation(
        shaderProgramObject,
        "u_viewMatrix"
    );
    projectionMatrixUniform = gl.getUniformLocation(
        shaderProgramObject,
        "u_projectionMatrix"
    );

    colorUniform = gl.getUniformLocation(shaderProgramObject, "u_color");
    exposureUniform = gl.getUniformLocation(shaderProgramObject, "u_exposure");
    decayUniform = gl.getUniformLocation(shaderProgramObject, "u_decay");
    densityUniform = gl.getUniformLocation(shaderProgramObject, "u_density");
    weightUniform = gl.getUniformLocation(shaderProgramObject, "u_weight");
    lightPositionOnScreenUniform = gl.getUniformLocation(shaderProgramObject, "u_lightPositionOnScreen");
    myTextureUniform = gl.getUniformLocation(shaderProgramObject, "u_textureSampler");
}

function passthroughShaderOperations() {
    // Vertex Shader
    const vertexShaderSourceCode = `#version 300 es
    in vec4 a_position;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;

    void main() {
        gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * a_position;
    }
    `;

    let vertexShaderObject = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShaderObject, vertexShaderSourceCode);
    gl.compileShader(vertexShaderObject);

    if (gl.getShaderParameter(vertexShaderObject, gl.COMPILE_STATUS) === false) {
        let error = gl.getShaderInfoLog(vertexShaderObject);
        if (error.length) {
            alert("SSS: Passthrough Vertex Shader Compilation Log: " + error);
            uninitialize();
        }
    }

    // Fragment Shader
    const fragmentShaderSourceCode = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform vec4 u_color;
    void main() {
        fragColor = u_color;
    }
    `;

    let fragmentShaderObject = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShaderObject, fragmentShaderSourceCode);
    gl.compileShader(fragmentShaderObject);

    if (
        gl.getShaderParameter(fragmentShaderObject, gl.COMPILE_STATUS) === false
    ) {
        let error = gl.getShaderInfoLog(fragmentShaderObject);
        if (error.length) {
            alert("SSS: Passthrough Fragment Shader Compilation Log: " + error);
            uninitialize();
        }
    }

    // Shader Program
    shaderProgramObject_passthrough = gl.createProgram();

    gl.attachShader(shaderProgramObject_passthrough, vertexShaderObject);
    gl.attachShader(shaderProgramObject_passthrough, fragmentShaderObject);

    // Pre-linking
    gl.bindAttribLocation(
        shaderProgramObject_passthrough,
        webGLMacros.SSS_ATTRIBUTE_POSITION,
        "a_position"
    );

    // gl.bindAttribLocation(
    //     shaderProgramObject_passthrough,
    //     webGLMacros.SSS_ATTRIBUTE_TEXTURE0,
    //     "a_texcoord"
    // );

    // linking
    gl.linkProgram(shaderProgramObject_passthrough);

    // link error checking
    if (gl.getProgramParameter(shaderProgramObject_passthrough, gl.LINK_STATUS) === false) {
        let error = gl.getProgramInfoLog(shaderProgramObject_passthrough);
        if (error.length) {
            alert("SSS: Passthrough Shader Program Linking Log: " + error);
            uninitialize();
        }
    }

    // fetch uniform locations
    modelMatrixUniform_passthrough = gl.getUniformLocation(
        shaderProgramObject_passthrough,
        "u_modelMatrix"
    );
    viewMatrixUniform_passthrough = gl.getUniformLocation(
        shaderProgramObject_passthrough,
        "u_viewMatrix"
    );
    projectionMatrixUniform_passthrough = gl.getUniformLocation(
        shaderProgramObject_passthrough,
        "u_projectionMatrix"
    );

    colorUniform_passthrought = gl.getUniformLocation(shaderProgramObject_passthrough, "u_color");
}

function texturePassthroughOperations() {
    // Vertex Shader
    const vertexShaderSourceCode = `#version 300 es
    in vec4 a_position;
    in vec2 a_texcoord;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;

    out vec2 a_texcoord_out;
    void main() {
        a_texcoord_out = a_texcoord;
        gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * a_position;
    }
    `;

    let vertexShaderObject = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShaderObject, vertexShaderSourceCode);
    gl.compileShader(vertexShaderObject);

    if (gl.getShaderParameter(vertexShaderObject, gl.COMPILE_STATUS) === false) {
        let error = gl.getShaderInfoLog(vertexShaderObject);
        if (error.length) {
            alert("SSS: Texture Vertex Shader Compilation Log: " + error);
            uninitialize();
        }
    }

    // Fragment Shader
    const fragmentShaderSourceCode = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    in vec2 a_texcoord_out;
    uniform sampler2D u_textureSampler;
    void main() {
        fragColor = texture(u_textureSampler, a_texcoord_out);
    }
    `;

    let fragmentShaderObject = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShaderObject, fragmentShaderSourceCode);
    gl.compileShader(fragmentShaderObject);

    if (
        gl.getShaderParameter(fragmentShaderObject, gl.COMPILE_STATUS) === false
    ) {
        let error = gl.getShaderInfoLog(fragmentShaderObject);
        if (error.length) {
            alert("SSS: Texture Fragment Shader Compilation Log: " + error);
            uninitialize();
        }
    }

    // Shader Program
    shaderProgramObject_texture = gl.createProgram();

    gl.attachShader(shaderProgramObject_texture, vertexShaderObject);
    gl.attachShader(shaderProgramObject_texture, fragmentShaderObject);

    // Pre-linking
    gl.bindAttribLocation(
        shaderProgramObject_texture,
        webGLMacros.SSS_ATTRIBUTE_POSITION,
        "a_position"
    );

    gl.bindAttribLocation(
        shaderProgramObject_texture,
        webGLMacros.SSS_ATTRIBUTE_TEXTURE0,
        "a_texcoord"
    );

    // linking
    gl.linkProgram(shaderProgramObject_texture);

    // link error checking
    if (gl.getProgramParameter(shaderProgramObject_texture, gl.LINK_STATUS) === false) {
        let error = gl.getProgramInfoLog(shaderProgramObject_texture);
        if (error.length) {
            alert("SSS: Texture Shader Program Linking Log: " + error);
            uninitialize();
        }
    }

    // fetch uniform locations
    modelMatrixUniform_texture = gl.getUniformLocation(
        shaderProgramObject_texture,
        "u_modelMatrix"
    );
    viewMatrixUniform_texture = gl.getUniformLocation(
        shaderProgramObject_texture,
        "u_viewMatrix"
    );
    projectionMatrixUniform_texture = gl.getUniformLocation(
        shaderProgramObject_texture,
        "u_projectionMatrix"
    );
    textureSamplerUniform_texture0 = gl.getUniformLocation(shaderProgramObject_texture, "u_textureSampler");
}

function finalPassthroughOperations() {
    // Vertex Shader
    const vertexShaderSourceCode = `#version 300 es
    in vec4 a_position;
    in vec2 a_texcoord;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;

    out vec2 a_texcoord_out;
    void main() {
        a_texcoord_out = a_texcoord;
        gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * a_position;
    }
    `;

    let vertexShaderObject = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShaderObject, vertexShaderSourceCode);
    gl.compileShader(vertexShaderObject);

    if (gl.getShaderParameter(vertexShaderObject, gl.COMPILE_STATUS) === false) {
        let error = gl.getShaderInfoLog(vertexShaderObject);
        if (error.length) {
            alert("SSS: Texture Vertex Shader Compilation Log: " + error);
            uninitialize();
        }
    }

    // Fragment Shader
    const fragmentShaderSourceCode = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    in vec2 a_texcoord_out;
    uniform sampler2D u_textureSampler0;
    uniform sampler2D u_textureSampler1;
    void main() {
        fragColor = texture(u_textureSampler0, a_texcoord_out) + texture(u_textureSampler1, a_texcoord_out);
    }
    `;

    let fragmentShaderObject = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShaderObject, fragmentShaderSourceCode);
    gl.compileShader(fragmentShaderObject);

    if (
        gl.getShaderParameter(fragmentShaderObject, gl.COMPILE_STATUS) === false
    ) {
        let error = gl.getShaderInfoLog(fragmentShaderObject);
        if (error.length) {
            alert("SSS: Texture Fragment Shader Compilation Log: " + error);
            uninitialize();
        }
    }

    // Shader Program
    shaderProgramObject_final = gl.createProgram();

    gl.attachShader(shaderProgramObject_final, vertexShaderObject);
    gl.attachShader(shaderProgramObject_final, fragmentShaderObject);

    // Pre-linking
    gl.bindAttribLocation(
        shaderProgramObject_final,
        webGLMacros.SSS_ATTRIBUTE_POSITION,
        "a_position"
    );

    gl.bindAttribLocation(
        shaderProgramObject_final,
        webGLMacros.SSS_ATTRIBUTE_TEXTURE0,
        "a_texcoord"
    );

    // linking
    gl.linkProgram(shaderProgramObject_final);

    // link error checking
    if (gl.getProgramParameter(shaderProgramObject_final, gl.LINK_STATUS) === false) {
        let error = gl.getProgramInfoLog(shaderProgramObject_final);
        if (error.length) {
            alert("SSS: Texture Shader Program Linking Log: " + error);
            uninitialize();
        }
    }

    // fetch uniform locations
    modelMatrixUniform_texture = gl.getUniformLocation(
        shaderProgramObject_final,
        "u_modelMatrix"
    );
    viewMatrixUniform_texture = gl.getUniformLocation(
        shaderProgramObject_final,
        "u_viewMatrix"
    );
    projectionMatrixUniform_texture = gl.getUniformLocation(
        shaderProgramObject_final,
        "u_projectionMatrix"
    );

    textureSamplerUniform_final0 = gl.getUniformLocation(shaderProgramObject_final, "u_textureSampler0");
    textureSamplerUniform_final1 = gl.getUniformLocation(shaderProgramObject_final, "u_textureSampler1");
}

function createFBO_One() {
    let textureWidth = FBO_WIDTH;
    let textureHeight = FBO_HEIGHT;

    // Create Frame Buffer
    fbo_pass_one = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo_pass_one);

        // Create Render Buffer Object
        rbo_pass_one = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rbo_pass_one);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, textureWidth, textureHeight);
        
        // Create empty texture
        fbo_pass_one_texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, fbo_pass_one_texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        // gl.generateMipmap(gl.TEXTURE_2D);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureWidth, textureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbo_pass_one_texture, 0);

        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo_pass_one);

        let result = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

        if (result != gl.FRAMEBUFFER_COMPLETE) {
            console.log("checkFramebufferStatus: Framebuffer creation failed.");
            return false;
        }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (result) {

    }

    return true;
}

function createFBO_Two() {
    let textureWidth = FBO_WIDTH;
    let textureHeight = FBO_HEIGHT;

    // Create Frame Buffer
    fbo_pass_two = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo_pass_two);

        // Create Render Buffer Object
        rbo_pass_two = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rbo_pass_two);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, textureWidth, textureHeight);
        
        // Create empty texture
        fbo_pass_two_texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, fbo_pass_two_texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        // gl.generateMipmap(gl.TEXTURE_2D);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureWidth, textureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbo_pass_two_texture, 0);

        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo_pass_two);

        let result = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

        if (result != gl.FRAMEBUFFER_COMPLETE) {
            console.log("checkFramebufferStatus: Framebuffer creation failed. two");
            return false;
        }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (result) {

    }

    return true;
}

function createFBO_Three() {
    let textureWidth = FBO_WIDTH;
    let textureHeight = FBO_HEIGHT;

    // Create Frame Buffer
    fbo_pass_three = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo_pass_three);

        // Create Render Buffer Object
        rbo_pass_three = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rbo_pass_three);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, textureWidth, textureHeight);
        
        // Create empty texture
        fbo_pass_three_texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, fbo_pass_three_texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        // gl.generateMipmap(gl.TEXTURE_2D);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureWidth, textureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbo_pass_three_texture, 0);

        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo_pass_three);

        let result = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

        if (result != gl.FRAMEBUFFER_COMPLETE) {
            console.log("checkFramebufferStatus: Framebuffer creation failed. three");
            return false;
        }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (result) {

    }

    return true;
}

function degreeToRadians(degree) {
    return degree * Math.PI / 180;
}


function initialize() {
    // code

    // Get webGL2.0 context from canvas
    gl = canvas.getContext("webgl2");

    if (!gl) {
        console.log('Obtaining gl context failed.');
    } else {
        console.log('Obtaining gl context successful.');
    }

    // Set viewport width and height of gl context
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;

    normalShaderOperations();
    passthroughShaderOperations();
    texturePassthroughOperations();
    finalPassthroughOperations();

    b_fbo_pass_one_result = createFBO_One();
    b_fbo_pass_two_result = createFBO_Two();
    b_fbo_pass_three_result = createFBO_Three();

    console.log("Create FBO1: ", b_fbo_pass_one_result);
    console.log("Create FBO2: ", b_fbo_pass_two_result);
    console.log("Create FBO3: ", b_fbo_pass_three_result);

    const quadOrthoVertices = new Float32Array([
        1.0, 1.0, 1.0,
        -1.0, 1.0, 1.0,
        -1.0, -1.0, 1.0,
        1.0, -1.0, 1.0
    ]);

    const quadOrthoTexCoords = new Float32Array([
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,
        1.0, 0.0,
    ])

    const cubeVertices = new Float32Array([
        1.0, 1.0, 1.0,
        -1.0, 1.0, 1.0,
        -1.0, -1.0, 1.0,
        1.0, -1.0, 1.0,

        1.0, 1.0, -1.0,
        1.0, 1.0, 1.0,
        1.0, -1.0, 1.0,
        1.0, -1.0, -1.0,

        1.0, 1.0, -1.0,
        -1.0, 1.0, -1.0,
        -1.0, -1.0, -1.0,
        1.0, -1.0, -1.0,

        -1.0, 1.0, 1.0,
        -1.0, 1.0, -1.0,
        -1.0, -1.0, -1.0,
        -1.0, -1.0, 1.0,

        1.0, 1.0, -1.0,
        -1.0, 1.0, -1.0,
        -1.0, 1.0, 1.0,
        1.0, 1.0, 1.0,

        -1.0, -1.0, -1.0,
        1.0, -1.0, -1.0,
        1.0, -1.0, 1.0,
        -1.0, -1.0, 1.0,
    ]);

    const cubeNormals = new Float32Array([
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,

        1.0, 0.0, 0.0,
        1.0, 0.0, 0.0,
        1.0, 0.0, 0.0,
        1.0, 0.0, 0.0,

        0.0, 0.0, -1.0,
        0.0, 0.0, -1.0,
        0.0, 0.0, -1.0,
        0.0, 0.0, -1.0,

        -1.0, 0.0, 0.0,
        -1.0, 0.0, 0.0,
        -1.0, 0.0, 0.0,
        -1.0, 0.0, 0.0,

        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 1.0, 0.0,

        0.0, -1.0, 0.0,
        0.0, -1.0, 0.0,
        0.0, -1.0, 0.0,
        0.0, -1.0, 0.0,
    ]);

    const cubeTexCoords = new Float32Array([
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,

        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,

        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,

        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,

        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,

        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0
    ]);

    vao_quad = gl.createVertexArray();
    gl.bindVertexArray(vao_quad);

        vbo_quad_vertices = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo_quad_vertices);
        gl.bufferData(gl.ARRAY_BUFFER, quadOrthoVertices, gl.STATIC_DRAW);
        gl.vertexAttribPointer(
            webGLMacros.SSS_ATTRIBUTE_POSITION,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(webGLMacros.SSS_ATTRIBUTE_POSITION);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);


        vbo_quad_texcoord = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo_quad_texcoord);
        gl.bufferData(gl.ARRAY_BUFFER, quadOrthoTexCoords, gl.STATIC_DRAW);
        gl.vertexAttribPointer(
            webGLMacros.SSS_ATTRIBUTE_TEXTURE0,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(webGLMacros.SSS_ATTRIBUTE_TEXTURE0);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);

    // vao_cube
    vao_cube = gl.createVertexArray();
    gl.bindVertexArray(vao_cube);

    // vbo_cube
    vbo_cube_vertice = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_cube_vertice);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(
        webGLMacros.SSS_ATTRIBUTE_POSITION,
        3,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(webGLMacros.SSS_ATTRIBUTE_POSITION);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // vbo_cube_texcoords
    vbo_cube_texcoord = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_cube_texcoord);
    gl.bufferData(gl.ARRAY_BUFFER, cubeTexCoords, gl.STATIC_DRAW);
    gl.vertexAttribPointer(
        webGLMacros.SSS_ATTRIBUTE_TEXTURE0,
        2,
        gl.FLOAT,
        false,
        0,
        0
    );
    gl.enableVertexAttribArray(webGLMacros.SSS_ATTRIBUTE_TEXTURE0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.bindVertexArray(null);

    // Depth and clear color
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    // gl.enable(gl.CULL_FACE);

    // clear screen with blue color
    gl.clearColor(0, 0, 0, 1);

    perspectiveProjectionMatrix = mat4.create();

    handleRangeSliders();
}

function handleRangeSliders() {
    /********************************* */
    let exposure = document.getElementById('exposure');
    let decay = document.getElementById('decay');
    let density = document.getElementById('density');
    let weight = document.getElementById('weight');
    let lPosX = document.getElementById('lPosX');
    let lPosY = document.getElementById('lPosY');

    exposure.value = parseFloat(settings.exposure);
    decay.value = parseFloat(settings.decay);
    density.value = parseFloat(settings.density);
    weight.value = parseFloat(settings.weight);
    lPosX.value = parseFloat(settings.lPosX);
    lPosY.value = parseFloat(settings.lPosY);

    document.getElementById('exposure_value').textContent = parseFloat(settings.exposure);
    document.getElementById('decay_value').textContent = parseFloat(settings.decay);
    document.getElementById('density_value').textContent = parseFloat(settings.density);
    document.getElementById('weight_value').textContent = parseFloat(settings.weight);
    document.getElementById('lPosX_value').textContent = parseFloat(settings.lPosX);
    document.getElementById('lPosY_value').textContent = parseFloat(settings.lPosY);

    exposure.oninput = () => {
        settings.exposure = parseFloat(exposure.value);
        document.getElementById("exposure_value").textContent = parseFloat(exposure.value);
    }

    decay.oninput = () => {
        settings.decay = parseFloat(decay.value);
        document.getElementById("decay_value").textContent = parseFloat(decay.value);
    }

    density.oninput = () => {
        settings.density = parseFloat(density.value);
        document.getElementById("density_value").textContent = parseFloat(density.value);
    }

    weight.oninput = () => {
        settings.weight = parseFloat(weight.value);
        document.getElementById("weight_value").textContent = parseFloat(weight.value);
    }

    lPosX.oninput = () => {
        settings.lPosX = parseFloat(lPosX.value);
        document.getElementById("lPosX_value").textContent = parseFloat(lPosX.value);
    }

    lPosY.oninput = () => {
        settings.lPosY = parseFloat(lPosY.value);
        document.getElementById("lPosY_value").textContent = parseFloat(lPosY.value);
    }
    /********************************* */
}

function resize() {
    // code
    if (bfullScreen === true) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    } else {
        canvas.width = canvas_original_width;
        canvas.height = canvas_original_height;
    }

    if (canvas.height === 0) {
        canvas.height = 1;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);

    mat4.perspective(perspectiveProjectionMatrix, 45.0, parseFloat(canvas.width) / parseFloat(canvas.height), 0.1, 100.0);
}

function customResize(width, height) {
    if (height === 0) {
        height = 1;
    }

    gl.viewport(0, 0, width, height);
    perspectiveProjectionMatrix = mat4.create();
    // console.log(perspectiveProjectionMatrix_cube, 45.0, parseFloat(width) / parseFloat(height), 0.1, 100.0);
    mat4.perspective(perspectiveProjectionMatrix, 45.0, parseFloat(width) / parseFloat(height), 0.1, 100.0);
}

function display() {
    update();

    let translationMatrix = mat4.create();
    let rotationMatrix = mat4.create();
    let scaleMatrix = mat4.create();
    let modelMatrix = mat4.create();
    let viewMatrix = mat4.create();

    /********************* Pass One ************************************************/
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo_pass_one);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        customResize(FBO_WIDTH, FBO_HEIGHT);

        gl.useProgram(shaderProgramObject_passthrough)
            gl.uniformMatrix4fv(viewMatrixUniform_passthrough, false, viewMatrix);
            gl.uniformMatrix4fv(projectionMatrixUniform_passthrough, false, perspectiveProjectionMatrix);

            /******************** light navigator ********************* */
            mat4.translate(translationMatrix, translationMatrix, [0.0, 1.0, -15]);
            mat4.scale(scaleMatrix, scaleMatrix, [0.85, 0.85, 0.85]);

            mat4.multiply(modelMatrix, translationMatrix, scaleMatrix);
            gl.uniformMatrix4fv(modelMatrixUniform_passthrough, false, modelMatrix);

            gl.uniform4f(colorUniform_passthrought, 1.0, 1.0, 1.0, 1.0);

            drawCube();
            /***************************************************************** */

            scaleMatrix = mat4.create();
            modelMatrix = mat4.create();
            translationMatrix = mat4.create();

            /********************** Main Object *******************************/
            mat4.translate(translationMatrix, translationMatrix, [0.0, 0.5, -6.0]);
            mat4.scale(scaleMatrix, scaleMatrix, [0.15, 0.25, 0.15]);
            mat4.rotateX(rotationMatrix, rotationMatrix, angleCube);
            mat4.rotateY(rotationMatrix, rotationMatrix, angleCube);
            mat4.rotateZ(rotationMatrix, rotationMatrix, angleCube);
    
            mat4.multiply(modelMatrix, translationMatrix, rotationMatrix);
            mat4.multiply(modelMatrix, modelMatrix, scaleMatrix);
    
            gl.uniformMatrix4fv(modelMatrixUniform_passthrough, false, modelMatrix);

            gl.uniform4f(colorUniform_passthrought, 0.0, 0.0, 0.0, 1.0);

            drawCube();
            /**************************************************************** */
        gl.useProgram(null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    /*******************************************************************************/

    scaleMatrix = mat4.create();
    modelMatrix = mat4.create();
    translationMatrix = mat4.create();
    rotationMatrix = mat4.create();

    /***************** pass two *******************************************/
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo_pass_two);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        customResize(FBO_WIDTH, FBO_HEIGHT);

        gl.useProgram(shaderProgramObject_passthrough)
            gl.uniformMatrix4fv(viewMatrixUniform_passthrough, false, viewMatrix);
            gl.uniformMatrix4fv(projectionMatrixUniform_passthrough, false, perspectiveProjectionMatrix);

            /********************** Main Object *******************************/
            mat4.translate(translationMatrix, translationMatrix, [0.0, 0.5, -6.0]);
            mat4.scale(scaleMatrix, scaleMatrix, [0.15, 0.25, 0.15]);
            mat4.rotateX(rotationMatrix, rotationMatrix, angleCube);
            mat4.rotateY(rotationMatrix, rotationMatrix, angleCube);
            mat4.rotateZ(rotationMatrix, rotationMatrix, angleCube);
    
            mat4.multiply(modelMatrix, translationMatrix, rotationMatrix);
            mat4.multiply(modelMatrix, modelMatrix, scaleMatrix);
    
            gl.uniformMatrix4fv(modelMatrixUniform_passthrough, false, modelMatrix);

            gl.uniform4f(colorUniform_passthrought, 1.0, 0.0, 0.0, 1.0);

            drawCube();
            /**************************************************************** */
        gl.useProgram(null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    /*************************************************************************** */

    scaleMatrix = mat4.create();
    modelMatrix = mat4.create();
    translationMatrix = mat4.create();
    rotationMatrix = mat4.create();

    /********************* Pass Three ************************************************/
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo_pass_three);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        customResize(FBO_WIDTH, FBO_HEIGHT);

        gl.useProgram(shaderProgramObject)
            let lx = canvas.width / parseFloat(FBO_WIDTH/2);
            let ly = canvas.height / parseFloat(FBO_HEIGHT/2);
            let lightPositionOnScreen = new Float32Array([lx, -ly/2])

            gl.uniform1f(exposureUniform, settings.exposure);
            gl.uniform1f(decayUniform, settings.decay);
            gl.uniform1f(densityUniform, settings.density);
            gl.uniform1f(weightUniform, settings.weight);
            gl.uniform2fv(lightPositionOnScreenUniform, lightPositionOnScreen);

            gl.uniformMatrix4fv(viewMatrixUniform, false, mat4.create());
            gl.uniformMatrix4fv(projectionMatrixUniform, false, mat4.create());
            gl.uniformMatrix4fv(modelMatrixUniform, false, mat4.create());
            // gl.uniform4f(colorUniform, 1.0, 0.0, 1.0, 1.0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, fbo_pass_one_texture);
            gl.uniform1i(myTextureUniform, 0);

            // gl.enable(gl.BLEND);
            // gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

            drawQuad();
        gl.useProgram(null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    /*******************************************************************************/

    scaleMatrix = mat4.create();
    modelMatrix = mat4.create();
    translationMatrix = mat4.create();
    rotationMatrix = mat4.create();

    /***************** Pass Four *******************************************/
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    perspectiveProjectionMatrix = mat4.create();
    resize();

    gl.useProgram(shaderProgramObject_final);
        gl.uniformMatrix4fv(viewMatrixUniform_texture, false, mat4.create());
        gl.uniformMatrix4fv(projectionMatrixUniform_texture, false, mat4.create());

        mat4.translate(translationMatrix, translationMatrix, [0.0, 0.0, -2.0]);

        mat4.multiply(modelMatrix, modelMatrix, translationMatrix);
        gl.uniformMatrix4fv(modelMatrixUniform_texture, false, mat4.create());

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fbo_pass_two_texture);
        gl.uniform1i(textureSamplerUniform_final0, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, fbo_pass_three_texture);
        gl.uniform1i(textureSamplerUniform_final1, 1);

        drawQuad();

        gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);
    /*************************************************************************** */

    // /***************** texture on quad *******************************************/
    // gl.clearColor(1.0, 0.0, 0.0, 1.0);

    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // perspectiveProjectionMatrix = mat4.create();
    // resize();

    // gl.useProgram(shaderProgramObject_texture);
    //     gl.uniformMatrix4fv(viewMatrixUniform_texture, false, viewMatrix);
    //     gl.uniformMatrix4fv(projectionMatrixUniform_texture, false, perspectiveProjectionMatrix);

    //     mat4.translate(translationMatrix, translationMatrix, [0.0, 0.0, -2.0]);

    //     mat4.multiply(modelMatrix, modelMatrix, translationMatrix);
    //     gl.uniformMatrix4fv(modelMatrixUniform_texture, false, modelMatrix);

    //     gl.activeTexture(gl.TEXTURE0);
    //     gl.bindTexture(gl.TEXTURE_2D, fbo_pass_three_texture);
    //     gl.uniform1i(textureSamplerUniform_texture0, 0);

    //     drawQuad();

    //     gl.bindTexture(gl.TEXTURE_2D, null);
    // gl.useProgram(null);
    // /*************************************************************************** */
    
    // double buffer emulation
    requestAnimationFrame(display, canvas);
}

function drawCube() {
    gl.bindVertexArray(vao_cube);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        gl.drawArrays(gl.TRIANGLE_FAN, 4, 4);
        gl.drawArrays(gl.TRIANGLE_FAN, 8, 4);
        gl.drawArrays(gl.TRIANGLE_FAN, 12, 4);
        gl.drawArrays(gl.TRIANGLE_FAN, 16, 4);
        gl.drawArrays(gl.TRIANGLE_FAN, 20, 4);
    gl.bindVertexArray(null);
}

function drawQuad() {
    gl.bindVertexArray(vao_quad);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    gl.bindVertexArray(null);
}

function toShow() {
       gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Use shader program object
        gl.useProgram(shaderProgramObject);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fbo_pass_one_texture);
        gl.uniform1i(myTextureUniform, 0);

        // Transformation matrix
        let translationMatrix = mat4.create();
        let rotationMatrix = mat4.create();
        let scaleMatrix = mat4.create();
        let modelMatrix = mat4.create();
        let viewMatrix = mat4.create();
        let lightPositionOnScreen = new Float32Array([settings.lPosX, settings.lPosY, translateZ])

        gl.uniform1f(exposureUniform, settings.exposure);
        gl.uniform1f(decayUniform, settings.decay);
        gl.uniform1f(densityUniform, settings.density);
        gl.uniform1f(weightUniform, settings.weight);
        gl.uniform3fv(lightPositionOnScreenUniform, lightPositionOnScreen);

        gl.uniformMatrix4fv(viewMatrixUniform, false, viewMatrix);
        gl.uniformMatrix4fv(projectionMatrixUniform, false, perspectiveProjectionMatrix);

        /******************** light navigator ********************* */
        mat4.translate(translationMatrix, translationMatrix, [settings.lPosX, settings.lPosY, translateZ]);
        mat4.scale(scaleMatrix, scaleMatrix, [0.15, 0.5, 0.15]);

        mat4.multiply(modelMatrix, translationMatrix, scaleMatrix);
        gl.uniformMatrix4fv(modelMatrixUniform, false, modelMatrix);

        gl.bindVertexArray(vao_cube);
            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
            gl.drawArrays(gl.TRIANGLE_FAN, 4, 4);
            gl.drawArrays(gl.TRIANGLE_FAN, 8, 4);
            gl.drawArrays(gl.TRIANGLE_FAN, 12, 4);
            gl.drawArrays(gl.TRIANGLE_FAN, 16, 4);
            gl.drawArrays(gl.TRIANGLE_FAN, 20, 4);
        gl.bindVertexArray(null);

        scaleMatrix = mat4.create();
        modelMatrix = mat4.create();
        translationMatrix = mat4.create();
        /***************************************************************** */

        /************************* Bottom Plane **************************** */

        mat4.translate(translationMatrix, translationMatrix, [0.0, -5.5, -5.0]);
        mat4.scale(scaleMatrix, scaleMatrix, [4.0, 4.0, 4.0]);

        mat4.multiply(modelMatrix, translationMatrix, scaleMatrix);
        gl.uniformMatrix4fv(modelMatrixUniform, false, modelMatrix);

        gl.bindVertexArray(vao_cube);
            gl.drawArrays(gl.TRIANGLE_FAN, 16, 4);
        gl.bindVertexArray(null);

        scaleMatrix = mat4.create();
        modelMatrix = mat4.create();
        translationMatrix = mat4.create();

        /******************************************************************** */

        mat4.translate(translationMatrix, translationMatrix, [0.0, 0.0, -10.0]);
        mat4.rotateX(rotationMatrix, rotationMatrix, angleCube);
        mat4.rotateY(rotationMatrix, rotationMatrix, angleCube);
        mat4.rotateZ(rotationMatrix, rotationMatrix, angleCube);

        mat4.multiply(modelMatrix, translationMatrix, rotationMatrix);

        gl.uniformMatrix4fv(modelMatrixUniform, false, modelMatrix);

        gl.bindVertexArray(vao_cube);
            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
            gl.drawArrays(gl.TRIANGLE_FAN, 4, 4);
            gl.drawArrays(gl.TRIANGLE_FAN, 8, 4);
            gl.drawArrays(gl.TRIANGLE_FAN, 12, 4);
            gl.drawArrays(gl.TRIANGLE_FAN, 16, 4);
            gl.drawArrays(gl.TRIANGLE_FAN, 20, 4);
        gl.bindVertexArray(null);

        gl.useProgram(null);

    // code
}

function update() {
    // code
    angleCube = angleCube + 0.01;
    if (angleCube >= 360.0)
        angleCube = -360.0;
}

// Keyboard event listener
function keyDown(event) {
    // code
    switch (event.key) {
        case "w":
        case "W":
            translateZ -= 1.0;
            break;

        case "s":
        case "S":
            translateZ += 1.0;
            break;

        case "ArrowUp":
            translateY += 1.0;
            break;

        case "ArrowDown":
            translateY -= 1.0;
            break;

        case "ArrowRight":
            translateX += 1.0;
            break;

        case "ArrowLeft":
            translateX -= 1.0;
            break;
    }

    console.log("x: ", translateX, "y: ", translateY, "z: ", translateZ);

    switch (event.keyCode) {
        case 69:
            uninitialize();
            window.close(); // all browser does not support this
            break;

        case 70:
            toggleFullscreen();
            break;
    }
}

function mouseDown(event) {
    // code
}

function uninitialize() {
    // code

    if (vao_cube) {
        gl.deleteVertexArray(vao_cube);
        vao_cube = null;
    }

    if (vbo_cube_vertice) {
        gl.deleteBuffer(vbo_cube_vertice);
        vbo_cube_vertice = null;
    }

    // Shader Uninitialize
    if (shaderProgramObject) {
        gl.useProgram(shaderProgramObject);
        let shaderObjects = gl.getAttachedShaders(shaderProgramObject);

        for (let i = 0; i < shaderObjects.length; i += 1) {
            gl.detachShader(shaderProgramObject, shaderObjects[i]);
            gl.deleteShader(shaderProgramObject[i]);
            shaderObjects[i] = null;
        }
        gl.useProgram(null);
        gl.deleteProgram(shaderProgramObject);
        shaderProgramObject = null;
    }
}

