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

const VERSION = "v5";          // 用来确认手机上加载的是不是最新代码
const MOVE_THRESHOLD = 0.4;    // 每帧转动小于这个角度（度）就当作"没在转"——给手抖留的余量
const FULL_SPEED = 3;          // 转动速度达到这个值（度/帧）时音量最大
const MAX_VOLUME = 0.7;        // 最大音量
const FADE = 0.08;             // 渐入渐隐的速度（越小越慢越柔和）

let lastTilt = null;           // 上一帧的倾斜角度
let smoothSpeed = 0;           // 平滑后的转动速度（过滤掉手抖的小跳动）
let smoothVolume = 0;          // 平滑后的音量

function accelerationChange(accx, accy, accz) {
}

function rotationChange(rotx, roty, rotz) {
    // 1. 左右倾斜的角度（rotationY），从弧度换成度数
    let tilt = Math.abs(degrees(roty));
    if (lastTilt === null) lastTilt = tilt;

    // 2. 转动速度 = 这一帧和上一帧的角度差，再做一点平滑，避免数值乱跳
    let speed = Math.abs(tilt - lastTilt);
    lastTilt = tilt;
    smoothSpeed = smoothSpeed + (speed - smoothSpeed) * 0.3;

    // 3. 目标音量：速度没超过余量 → 0（当作没在转）；超过后越快越响
    let targetVolume = 0;
    if (smoothSpeed > MOVE_THRESHOLD) {
        targetVolume = map(smoothSpeed, MOVE_THRESHOLD, FULL_SPEED, 0.2, MAX_VOLUME, true);
    }

    // 4. 渐入渐隐：音量每次只往目标走一小步
    smoothVolume = smoothVolume + (targetVolume - smoothVolume) * FADE;
    if (smoothVolume < 0.005) smoothVolume = 0;   // 足够小就直接归零，彻底安静

    // 5. 门的开合程度跟着倾斜角度：0~90 度 → 0.05~0.5；没声音时把门关上
    let position = map(tilt, 0, 90, 0.05, 0.5, true);
    if (smoothVolume === 0) position = 0;

    // 6. 在页面上显示版本、角度、速度和音量（调试用）
    statusLabels[1].html(VERSION + " tilt: " + round(tilt) +
                         " speed: " + nf(smoothSpeed, 1, 2) +
                         " vol: " + nf(smoothVolume, 1, 2));

    // 7. 把结果送给声音
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
