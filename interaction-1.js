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
        dspNode.setParamValue("/door/door/position", 0);   // 一开始门是关的，没有声音
        dspNode.connect(audioContext.destination);
        console.log('params: ', dspNode.getParams());
        const jsonString = dspNode.getJSON();
        jsonParams = JSON.parse(jsonString)["ui"][0]["items"];
        dspNodeParams = jsonParams
    });


//==========================================================================================
// INTERACTIONS
// 动作：手机平放在手上，左右倾斜（Table 1: "is placed flat in the hand and tilted from side to side"）
// 声音：开门的吱呀声。正在倾斜转动时有声音，停下来就没有声音。
//==========================================================================================

const VERSION = "v9";
const THRESHOLD = 10;     // 0.3 秒内倾斜变化超过 10 度，才算"在转"（手抖达不到）

let tiltHistory = [];     // 最近 20 帧（约 0.3 秒）的倾斜角度

function accelerationChange(accx, accy, accz) {
}

function rotationChange(rotx, roty, rotz) {
    // 1. 现在左右倾斜了多少度
    let tilt = Math.abs(degrees(roty));

    // 2. 记住最近 20 帧的角度，和 0.3 秒前比一比变了多少
    tiltHistory.push(tilt);
    if (tiltHistory.length > 20) tiltHistory.shift();
    let change = Math.abs(tilt - tiltHistory[0]);

    // 3. 变化够大 → 在转 → 门的声音跟着角度；否则 → 门关上 → 没声音
    let position = 0;
    if (change > THRESHOLD) {
        position = map(tilt, 0, 90, 0.1, 0.5, true);
    }

    // 4. 在页面上显示（调试用）
    statusLabels[1].html(VERSION + " tilt: " + round(tilt) + " change: " + round(change));

    // 5. 送给声音
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
