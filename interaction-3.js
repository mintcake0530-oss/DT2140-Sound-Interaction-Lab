//==========================================================================================
// AUDIO SETUP
//==========================================================================================
let dspNode = null;
let dspNodeParams = null;
let jsonParams = null;

// 声音文件：torpedo.wasm
const dspName = "torpedo";
const instance = new FaustWasm2ScriptProcessor(dspName);

// output to window or npm package module
if (typeof module === "undefined") {
    window[dspName] = instance;
} else {
    const exp = {};
    exp[dspName] = instance;
    module.exports = exp;
}

torpedo.createDSP(audioContext, 1024)
    .then(node => {
        dspNode = node;
        // 一开始保证扳机是松开的
        dspNode.setParamValue("/torpedo/trigger", 0);
        dspNode.connect(audioContext.destination);
        console.log('params: ', dspNode.getParams());
        const jsonString = dspNode.getJSON();
        jsonParams = JSON.parse(jsonString)["ui"][0]["items"];
        dspNodeParams = jsonParams
    });


//==========================================================================================
// INTERACTIONS
// 动作：摇晃手机（Table 1: "is shaken"）
// 声音：光子鱼雷（Sci-Fi photon torpedo）。像甩动手中的武器"发射"一样，
//      摇一下就发射一发；发射后有短暂的冷却时间，不会连续乱响。
//      摇晃的灵敏度可以用页面上的 "shake threshold" 拉条调整。
//==========================================================================================

const VERSION = "v1";          // 用来确认手机上加载的是不是最新代码
const TRIGGER_MS = 200;        // "扣扳机"按住多久（毫秒），越长声音拖得越久
const COOLDOWN_MS = 1000;      // 两次发射之间至少隔多久（毫秒）

let lastFire = 0;              // 上一次发射的时间
let fireCount = 0;             // 发射了几次（调试用）

function accelerationChange(accx, accy, accz) {
}

function rotationChange(rotx, roty, rotz) {
}

function mousePressed() {
    // 在电脑上测试时，点一下屏幕也能发射
    fire();
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
    fire();
}

// 发射一发鱼雷（带冷却时间，摇晃时不会每一帧都触发）
function fire() {
    if (millis() - lastFire < COOLDOWN_MS) {
        return;
    }
    lastFire = millis();
    fireCount++;
    statusLabels[0].html(VERSION + " shaken — 发射次数: " + fireCount);
    playAudio();
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

function playAudio() {
    if (!dspNode) {
        return;
    }
    if (audioContext.state === 'suspended') {
        return;
    }
    // 按下扳机，TRIGGER_MS 毫秒后松开
    dspNode.setParamValue("/torpedo/trigger", 1);
    setTimeout(() => { dspNode.setParamValue("/torpedo/trigger", 0) }, TRIGGER_MS);
}

//==========================================================================================
// END
//==========================================================================================
