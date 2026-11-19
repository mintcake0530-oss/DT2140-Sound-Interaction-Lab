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

function rotationChange(rotx, roty, rotz) {
    // 1. 左右倾斜的角度（rotationY），从弧度换成度数
    let tilt = Math.abs(degrees(roty));

    // 2. 把 0~90 度换算成门的开合程度 0~0.5
    let position = map(tilt, 0, 90, 0, 0.5, true);

    // 3. 在页面上显示当前角度（调试用）
    statusLabels[1].html("tilt: " + round(tilt));

    // 4. 把结果送给声音
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