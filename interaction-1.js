//==========================================================================================
// AUDIO SETUP
//------------------------------------------------------------------------------------------
//
//------------------------------------------------------------------------------------------
// Edit just where you're asked to!
//------------------------------------------------------------------------------------------
//
//==========================================================================================
let dspNode = null;
let dspNodeParams = null;
let jsonParams = null;

// Change here to ("tuono") depending on your wasm file name
const dspName = "door";
const instance = new FaustWasm2ScriptProcessor(dspName);

// output to window or npm package module
if (typeof module === "undefined") {
    window[dspName] = instance;
} else {
    const exp = {};
    exp[dspName] = instance;
    module.exports = exp;
}

// The name should be the same as the WASM file, so change tuono with brass if you use brass.wasm
door.createDSP(audioContext, 1024)
    .then(node => {
        dspNode = node;
        dspNode.connect(audioContext.destination);
        console.log('params: ', dspNode.getParams());
        const jsonString = dspNode.getJSON();
        jsonParams = JSON.parse(jsonString)["ui"][0]["items"];
        dspNodeParams = jsonParams
        // const exampleMinMaxParam = findByAddress(dspNodeParams, "/thunder/rumble");
        // // ALWAYS PAY ATTENTION TO MIN AND MAX, ELSE YOU MAY GET REALLY HIGH VOLUMES FROM YOUR SPEAKERS
        // const [exampleMinValue, exampleMaxValue] = getParamMinMax(exampleMinMaxParam);
        // console.log('Min value:', exampleMinValue, 'Max value:', exampleMaxValue);
    });


//==========================================================================================
// INTERACTIONS
//------------------------------------------------------------------------------------------
//
//------------------------------------------------------------------------------------------
// Edit the next functions to create interactions
// Decide which parameters you're using and then use playAudio to play the Audio
//------------------------------------------------------------------------------------------
//
//==========================================================================================

function accelerationChange(accx, accy, accz) {
    // playAudio()
}

let startAngle = null;   // 门"关着"时手机的朝向
let lastAngle = 0;       // 上一次算出来的开门角度
let smoothVolume = 0;    // 平滑后的音量

function rotationChange(rotx, roty, rotz) {
    // 声音还没开的时候什么都不做
    if (!dspNode || audioContext.state === 'suspended') return;

    rotz = degrees(rotz);   // 把弧度换成度数（0~6.28 → 0~360）

    // 1. 第一次运行时，把现在的朝向记为 0 度（门关着）
    if (startAngle === null) startAngle = rotz;

    // 2. 算出相对起点转了多少度（保留方向，有正负）
    let diff = rotz - startAngle;
    if (diff > 180) diff -= 360;   // 处理 359° 突然跳到 0° 的问题
    if (diff < -180) diff += 360;

    // 判断是否在 0~90 度的"开门范围"内
    let inRange = (diff >= 0 && diff <= 90);
    let angle = constrain(diff, 0, 90);

    // 3. 算转动速度：这次和上次的角度差多少
    let speed = Math.abs(angle - lastAngle);
    lastAngle = angle;

    // 4. 只有在范围内才有声音；超出范围目标音量就是 0
    let targetVolume = 0;
    if (inRange) {
        targetVolume = constrain(speed / 3, 0, 1);
    }

    // 5. 让音量慢慢靠近目标值 → 渐入渐隐
    smoothVolume = smoothVolume + (targetVolume - smoothVolume) * 0.1;

    // 6. 角度 0~90 换算成门的 0~0.5，连同音量一起送给声音
    let position = map(angle, 0, 90, 0, 0.5);
    playAudio(position, smoothVolume);
}

function mousePressed() {
    startAngle = null;
}

function deviceMoved() {
    movetimer = millis();
    statusLabels[2].style("color", "pink");
}

function deviceTurned() {
    threshVals[1] = turnAxis;
}
function deviceShaken() {
    shaketimer = millis();
    statusLabels[0].style("color", "pink");
    //playAudio();
}

function getMinMaxParam(address) {
    const exampleMinMaxParam = findByAddress(dspNodeParams, address);
    // ALWAYS PAY ATTENTION TO MIN AND MAX, ELSE YOU MAY GET REALLY HIGH VOLUMES FROM YOUR SPEAKERS
    const [exampleMinValue, exampleMaxValue] = getParamMinMax(exampleMinMaxParam);
    console.log('Min value:', exampleMinValue, 'Max value:', exampleMaxValue);
    return [exampleMinValue, exampleMaxValue]
}

//==========================================================================================
// AUDIO INTERACTION
//------------------------------------------------------------------------------------------
//
//------------------------------------------------------------------------------------------
// Edit here to define your audio controls 
//------------------------------------------------------------------------------------------
//
//==========================================================================================

function playAudio(position, volume) {
    if (!dspNode) {
        return;
    }
    if (audioContext.state === 'suspended') {
        return;
    }
    // Edit here the addresses ("/thunder/rumble") depending on your WASM controls (you can see 
    // them printed on the console of your browser when you load the page)
    // For example if you change to a bell sound, here you could use "/churchBell/gate" instead of
    // "/thunder/rumble".
    dspNode.setParamValue("/door/door/position", position)
    dspNode.setParamValue("/door/volume", volume);
}

//==========================================================================================
// END
//==========================================================================================