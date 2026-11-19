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

const VERSION = "v8";          // 用来确认手机上加载的是不是最新代码
const WINDOW = 15;             // 看最近多少帧（约 0.25 秒）的角度变化
const START_CHANGE = 8;        // 最近 0.25 秒里倾斜变化超过 8 度，才算"在开门"
const STOP_CHANGE = 4;         // 变化小于 4 度就算"停下"
const FULL_CHANGE = 25;        // 变化达到 25 度时音量最大（转得越快越响）
const MAX_VOLUME = 0.7;        // 最大音量
const FADE_IN = 0.04;          // 渐入速度：开始转时声音出现得慢一点（越小越慢）
const FADE_OUT = 0.3;          // 渐隐速度：停下后声音消失得快一些（越大越快）

let tiltHistory = [];          // 最近几帧的倾斜角度
let smoothVolume = 0;          // 平滑后的音量
let isMoving = false;          // 现在是不是在转

function accelerationChange(accx, accy, accz) {
}

function rotationChange(rotx, roty, rotz) {
    // 1. 左右倾斜的角度（rotationY），从弧度换成度数
    let tilt = Math.abs(degrees(roty));

    // 2. 记住最近 WINDOW 帧的角度
    tiltHistory.push(tilt);
    if (tiltHistory.length > WINDOW) tiltHistory.shift();

    // 3. 看"一段时间内整体转了多少"，而不是每一帧的小跳动：
    //    手抖是来回晃，整体变化很小；真的在开门是朝一个方向持续转，整体变化大
    let change = Math.abs(tilt - tiltHistory[0]);

    // 4. 判断是否在转：超过 START_CHANGE 才开始，低于 STOP_CHANGE 才停止
    if (!isMoving && change > START_CHANGE) isMoving = true;
    if (isMoving && change < STOP_CHANGE) isMoving = false;

    // 5. 在转 → 有目标音量（转得越快越响）；停下 → 目标音量 0
    let targetVolume = 0;
    if (isMoving) {
        targetVolume = map(change, STOP_CHANGE, FULL_CHANGE, 0.2, MAX_VOLUME, true);
    }

    // 6. 渐入渐隐：变大时用 FADE_IN（慢），变小时用 FADE_OUT（快）
    let fade = (targetVolume > smoothVolume) ? FADE_IN : FADE_OUT;
    smoothVolume = smoothVolume + (targetVolume - smoothVolume) * fade;
    if (smoothVolume < 0.01) smoothVolume = 0;   // 足够小就直接归零

    // 7. 门的开合程度：在转时跟着倾斜角度；一停下就立刻"关门"，让吱呀声本身停止
    let position = 0;
    if (isMoving) {
        position = map(tilt, 0, 90, 0.05, 0.5, true);
    }

    // 8. 在页面上显示调试信息
    statusLabels[1].html(VERSION + " tilt: " + round(tilt) +
                         " change: " + round(change) +
                         " vol: " + nf(smoothVolume, 1, 2) +
                         (isMoving ? " 转动中" : " 静止"));

    // 9. 把结果送给声音
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
