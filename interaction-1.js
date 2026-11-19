//==========================================================================================
// AUDIO SETUP
//==========================================================================================
let dspNode = null;
let dspNodeParams = null;
let jsonParams = null;

// 声音文件：door.wasm
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

door.createDSP(audioContext, 1024)
    .then(node => {
        dspNode = node;
        // 一开始就把门关上、音量设为 0，保证打开页面时是安静的
        dspNode.setParamValue("/door/door/position", 0);
        dspNode.setParamValue("/door/volume", 0);
        dspNode.connect(audioContext.destination);
        console.log('params: ', dspNode.getParams());
        const jsonString = dspNode.getJSON();
        jsonParams = JSON.parse(jsonString)["ui"][0]["items"];
        dspNodeParams = jsonParams
    });


//==========================================================================================
// INTERACTIONS
// 动作：手机平放在手上，左右倾斜（Table 1: "is placed flat in the hand and tilted from side to side"）
// 声音：开门的吱呀声。只有在"持续倾斜转动"时才有声音，停下来声音就渐渐消失，
//      就像真实的门：推动时吱呀响，不动就安静。倾斜角度越大，门开得越大。
//==========================================================================================

const VERSION = "v7";          // 用来确认手机上加载的是不是最新代码
const START_SPEED = 0.8;       // 速度超过这个值才算"开始转"（度/帧）
const STOP_SPEED = 0.5;        // 速度低于这个值就算"停下"——两个门槛不同，手抖时不会来回跳
const FULL_SPEED = 3;          // 转动速度达到这个值时音量最大
const MAX_VOLUME = 0.7;        // 最大音量
const FADE_IN = 0.04;          // 渐入速度：开始转时声音出现得慢一点（越小越慢）
const FADE_OUT = 0.3;          // 渐隐速度：停下后声音消失得快一些（越大越快）

let lastTilt = null;           // 上一帧的倾斜角度
let smoothSpeed = 0;           // 平滑后的转动速度
let smoothVolume = 0;          // 平滑后的音量
let isMoving = false;          // 现在是不是在转

function accelerationChange(accx, accy, accz) {
}

function rotationChange(rotx, roty, rotz) {
    // 1. 左右倾斜的角度（rotationY），从弧度换成度数
    let tilt = Math.abs(degrees(roty));
    if (lastTilt === null) lastTilt = tilt;

    // 2. 转动速度 = 这一帧和上一帧的角度差，再做一点平滑
    let speed = Math.abs(tilt - lastTilt);
    lastTilt = tilt;
    smoothSpeed = smoothSpeed + (speed - smoothSpeed) * 0.5;

    // 3. 判断是否在转：超过 START_SPEED 才开始，低于 STOP_SPEED 才停止
    if (!isMoving && smoothSpeed > START_SPEED) isMoving = true;
    if (isMoving && smoothSpeed < STOP_SPEED) isMoving = false;

    // 4. 在转 → 有目标音量；停下 → 目标音量 0
    let targetVolume = 0;
    if (isMoving) {
        targetVolume = map(smoothSpeed, STOP_SPEED, FULL_SPEED, 0.2, MAX_VOLUME, true);
    }

    // 5. 渐入渐隐：变大时用 FADE_IN（慢），变小时用 FADE_OUT（快）
    let fade = (targetVolume > smoothVolume) ? FADE_IN : FADE_OUT;
    smoothVolume = smoothVolume + (targetVolume - smoothVolume) * fade;
    if (smoothVolume < 0.01) smoothVolume = 0;   // 足够小就直接归零

    // 6. 门的开合程度：在转时跟着倾斜角度；一停下就立刻"关门"，让吱呀声本身停止
    let position = 0;
    if (isMoving) {
        position = map(tilt, 0, 90, 0.05, 0.5, true);
    }

    // 7. 在页面上显示调试信息
    statusLabels[1].html(VERSION + " tilt: " + round(tilt) +
                         " speed: " + nf(smoothSpeed, 1, 2) +
                         " vol: " + nf(smoothVolume, 1, 2) +
                         (isMoving ? " 转动中" : " 静止"));

    // 8. 把结果送给声音
    playAudio(position, smoothVolume);
}

function mousePressed() {
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
}

function getMinMaxParam(address) {
    const exampleMinMaxParam = findByAddress(dspNodeParams, address);
    const [exampleMinValue, exampleMaxValue] = getParamMinMax(exampleMinMaxParam);
    console.log('Min value:', exampleMinValue, 'Max value:', exampleMaxValue);
    return [exampleMinValue, exampleMaxValue]
}

//==========================================================================================
// AUDIO INTERACTION
//==========================================================================================

function playAudio(position, volume) {
    if (!dspNode) {
        return;
    }
    if (audioContext.state === 'suspended') {
        return;
    }
    dspNode.setParamValue("/door/door/position", position);
    dspNode.setParamValue("/door/volume", volume);
}

//==========================================================================================
// END
//==========================================================================================
