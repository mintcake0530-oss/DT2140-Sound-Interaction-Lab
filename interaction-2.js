//==========================================================================================
// AUDIO SETUP
//==========================================================================================
let dspNode = null;
let dspNodeParams = null;
let jsonParams = null;

// 声音文件：insects.wasm
const dspName = "insects";
const instance = new FaustWasm2ScriptProcessor(dspName);

// output to window or npm package module
if (typeof module === "undefined") {
    window[dspName] = instance;
} else {
    const exp = {};
    exp[dspName] = instance;
    module.exports = exp;
}

insects.createDSP(audioContext, 1024)
    .then(node => {
        dspNode = node;
        // 一开始把音量设为 0，保证打开页面时是安静的
        dspNode.setParamValue("/insects/gain", 0);
        dspNode.connect(audioContext.destination);
        console.log('params: ', dspNode.getParams());
        const jsonString = dspNode.getJSON();
        jsonParams = JSON.parse(jsonString)["ui"][0]["items"];
        dspNodeParams = jsonParams
    });


//==========================================================================================
// INTERACTIONS
// 动作：拿着手机，只对"很小的动作"有反应，大动作没有反应
//      （Table 1: "is held and used to detect all very small movements, but not large ones"）
// 声音：虫鸣。像在草丛边轻轻拨动，细微的动作会"唤醒"虫子；
//      动作太大会把虫子吓跑，声音停止，要安静一会儿虫子才会回来。
//==========================================================================================

const VERSION = "v3";          // 用来确认手机上加载的是不是最新代码
const WINDOW = 20;             // 看最近多少帧（约 0.3 秒）的动作强度
const SMALL_MIN = 1.0;         // 动作强度超过这个值才算"有小动作"（低于它 = 静止）
const SMALL_MAX = 10.0;        // 动作强度超过这个值就算"大动作"，虫子被吓跑
const SCARED_TIME = 2000;      // 被吓跑后安静多久（毫秒）
const MAX_GAIN = 0.8;          // 最大音量
const FADE_IN = 0.03;          // 虫鸣慢慢出现
const FADE_OUT = 0.25;         // 停下或被吓跑时较快消失

let lastAcc = null;            // 上一帧的加速度
let activityHistory = [];      // 最近几帧的动作强度
let smoothGain = 0;            // 平滑后的音量
let scaredUntil = 0;           // 虫子被吓跑到什么时候

function accelerationChange(accx, accy, accz) {
    // 1. 动作强度 = 这一帧和上一帧加速度的变化量（这样不受重力影响，只看"动"）
    if (lastAcc === null) lastAcc = [accx, accy, accz];
    let jerk = Math.sqrt(
        (accx - lastAcc[0]) ** 2 +
        (accy - lastAcc[1]) ** 2 +
        (accz - lastAcc[2]) ** 2
    );
    lastAcc = [accx, accy, accz];

    // 2. 取最近一段时间的平均值，避免数值乱跳
    activityHistory.push(jerk);
    if (activityHistory.length > WINDOW) activityHistory.shift();
    let activity = activityHistory.reduce((a, b) => a + b, 0) / activityHistory.length;

    // 3. 判断状态
    let state;
    if (activity > SMALL_MAX) {
        state = "大动作：虫子被吓跑";
        scaredUntil = millis() + SCARED_TIME;      // 吓跑后一段时间内都不出声
    } else if (millis() < scaredUntil) {
        state = "虫子还没回来";
    } else if (activity > SMALL_MIN) {
        state = "小动作：虫鸣";
    } else {
        state = "静止";
    }

    // 4. 目标音量：只有"小动作"时有声音，动作越明显虫鸣越大
    let targetGain = 0;
    if (state === "小动作：虫鸣") {
        targetGain = map(activity, SMALL_MIN, 6.0, 0.3, MAX_GAIN, true);
    }

    // 5. 渐入渐隐
    let fade = (targetGain > smoothGain) ? FADE_IN : FADE_OUT;
    smoothGain = smoothGain + (targetGain - smoothGain) * fade;
    if (smoothGain < 0.01) smoothGain = 0;

    // 6. 在页面上显示调试信息（"moved" 那一行）
    statusLabels[2].html(VERSION + " activity: " + nf(activity, 1, 2) +
                         " gain: " + nf(smoothGain, 1, 2) + " " + state);

    // 7. 把结果送给声音
    playAudio(smoothGain);
}

function rotationChange(rotx, roty, rotz) {
}

function mousePressed() {
}

function deviceMoved() {
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

function playAudio(gain) {
    if (!dspNode) {
        return;
    }
    if (audioContext.state === 'suspended') {
        return;
    }
    dspNode.setParamValue("/insects/gain", gain);
}

//==========================================================================================
// END
//==========================================================================================
