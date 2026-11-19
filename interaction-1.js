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
        dspNode.connect(audioContext.destination);
        console.log('params: ', dspNode.getParams());
        const jsonString = dspNode.getJSON();
        jsonParams = JSON.parse(jsonString)["ui"][0]["items"];
        dspNodeParams = jsonParams
    });


//==========================================================================================
// INTERACTIONS
// 动作：手机平放在手上，左右倾斜（Table 1: "is placed flat in the hand and tilted from side to side"）
// 声音：开门的吱呀声，倾斜越多，门开得越大
//==========================================================================================

function accelerationChange(accx, accy, accz) {
}

let smoothVolume = 0;   // 平滑后的音量（用来做渐入渐隐）

let smoothVolume = 0;   // 平滑后的音量（用来做渐入渐隐）

function rotationChange(rotx, roty, rotz) {
    // 1. 左右倾斜的角度（rotationY），从弧度换成度数
    let tilt = Math.abs(degrees(roty));

    // 2. 小于 20 度不出声（"死区"），避免手一抖就响
    let startTilt = 10;

    // 3. 目标音量：没到 20 度是 0，超过后随角度慢慢变大，最大 0.7
    let targetVolume = map(tilt, startTilt, 90, 0, 0.7, true);

    // 4. 渐入渐隐：音量每次只往目标走 5%
    smoothVolume = smoothVolume + (targetVolume - smoothVolume) * 0.05;

    // 5. 把 20~90 度换算成门的开合程度 0~0.5
    let position = map(tilt, startTilt, 90, 0, 0.5, true);

    // 6. 在页面上显示当前角度（调试用）
    statusLabels[1].html("tilt: " + round(tilt));

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