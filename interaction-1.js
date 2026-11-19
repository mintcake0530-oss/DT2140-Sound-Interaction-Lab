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
        // 一开始门是关的，没有声音
        dspNode.setParamValue("/door/door/position", 0);
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

const VERSION = "v10";
const STEP = 8;          // 倾斜变化超过 8 度，才算"转了一下"（手抖一般达不到）
const HOLD_MS = 300;     // 最后一次"转了一下"之后，声音再保持 0.3 秒；超过就停

let doorLastTilt = null; // 上一次"转了一下"时的角度
let lastMoveTime = 0;    // 上一次"转了一下"的时间

function accelerationChange(accx, accy, accz) {
}

function rotationChange(rotx, roty, rotz) {
    if (!dspNode || audioContext.state !== "running") return;

    // 1. 现在左右倾斜了多少度
    const tilt = degrees(roty);

    // 2. 第一次只记住起始角度
    if (doorLastTilt === null) {
        doorLastTilt = tilt;
        return;
    }

    // 3. 和上次相比转了超过 STEP 度 → 记为"刚刚在转"
    if (Math.abs(tilt - doorLastTilt) >= STEP) {
        doorLastTilt = tilt;
        lastMoveTime = millis();
    }

    // 4. 刚刚 0.3 秒内在转 → 门的声音跟着角度；否则把门关上 → 没声音
    let position = 0;
    if (millis() - lastMoveTime < HOLD_MS) {
        position = map(Math.abs(tilt), 0, 90, 0.1, 0.5, true);
    }

    // 5. 在页面上显示（调试用）
    statusLabels[1].html(VERSION + " tilt: " + round(tilt) + (position > 0 ? " 转动中" : " 静止"));

    // 6. 送给声音
    playAudio(position);
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

function playAudio(position) {
    if (!dspNode) {
        return;
    }
    if (audioContext.state === 'suspended') {
        return;
    }
    dspNode.setParamValue("/door/door/position", position);
}

//==========================================================================================
// END
//==========================================================================================
