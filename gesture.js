
import {
    HandLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

// =====================================================
// ELEMENTA × KIANA
// HOLOGRAPHIC GESTURE CONTROL ENGINE
// =====================================================


// =====================================================
// 1. DOM ELEMENTS
// =====================================================

const webcam = document.getElementById("webcam");
const canvas = document.getElementById("hand-canvas");
const gestureReadout = document.getElementById("gesture-readout");
const pinchStatus = document.getElementById("pinch-status");

const periodicGrid = document.getElementById("periodic-grid");
const kianaGrid = document.getElementById("kiana-element-grid");

const gestureCursor = document.getElementById("gesture-cursor");
const detailsPanel = document.getElementById("element-details");

const profilePanel = document.getElementById("kiana-profile-view");

const ctx = canvas?.getContext("2d");


// =====================================================
// 2. TRACKING STATE
// =====================================================

let handLandmarker = null;
let lastVideoTime = -1;
let animationFrameId = null;

let isPinching = false;
let tableExpanded = false;

let currentHoveredCard = null;
let hoverFrames = 0;

let smoothedX = null;
let smoothedY = null;

let noHandFrames = 0;
let lastHandCount = 0;

let expandFrames = 0;
let collapseFrames = 0;

let trackingErrorShown = false;

// Left-hand scrolling
let previousLeftY = null;
let smoothedLeftY = null;

// Right-hand swipe
let previousWristY = null;
let swipeStartY = null;
let swipeStartTime = 0;
let lastSwipeTime = 0;

// Pinch stability
let pinchStartFrames = 0;
let pinchReleaseFrames = 0;

// Debug information
let latestHandLabels = [];
let latestResults = null;

const NO_HAND_GRACE_FRAMES = 6;

// Pinch thresholds
const PINCH_START_DISTANCE = 0.045;
const PINCH_RELEASE_DISTANCE = 0.075;

const REQUIRED_PINCH_START_FRAMES = 2;
const REQUIRED_PINCH_RELEASE_FRAMES = 2;

// Two-hand controls
const EXPAND_DISTANCE = 0.48;
const COLLAPSE_DISTANCE = 0.34;

const REQUIRED_EXPAND_FRAMES = 3;
const REQUIRED_COLLAPSE_FRAMES = 3;

// Swipe controls
const SWIPE_DOWN_DISTANCE = 0.20;
const SWIPE_MAX_DURATION = 900;
const SWIPE_COOLDOWN = 1200;

// Left-hand scrolling
const SCROLL_DEAD_ZONE = 0.003;
const SCROLL_SENSITIVITY = 1.5;
const MAX_SCROLL_PER_FRAME = 28;

// Cursor smoothing
const CURSOR_DEAD_ZONE = 0.7;
const CURSOR_SLOW_SMOOTHING = 0.22;
const CURSOR_NORMAL_SMOOTHING = 0.38;
const CURSOR_FAST_SMOOTHING = 0.62;

window.elementaTrackingReady = false;


// =====================================================
// 3. DEBUG ACCESS
// =====================================================

window.kianaDebug = {

    getDetector: () => handLandmarker,

    getHandCount: () => lastHandCount,

    getHandLabels: () => latestHandLabels,

    getResults: () => latestResults,

    getScrollState: () => ({
        previousLeftY,
        smoothedLeftY,
        gridScrollTop: kianaGrid?.scrollTop,
        gridScrollHeight: kianaGrid?.scrollHeight,
        gridClientHeight: kianaGrid?.clientHeight
    }),

    getCursorState: () => ({
        smoothedX,
        smoothedY
    }),

    getPinchState: () => ({
        isPinching,
        pinchStartFrames,
        pinchReleaseFrames
    }),

    testScroll: () => {

        if (!kianaGrid) {
            return "Discovery grid not found";
        }

        kianaGrid.scrollTop += 100;

        return {
            scrollTop: kianaGrid.scrollTop,
            maximum:
                kianaGrid.scrollHeight - kianaGrid.clientHeight
        };
    }
};


// =====================================================
// 4. HAND CONNECTIONS
// =====================================================

const connections = [

    [0, 1], [1, 2], [2, 3], [3, 4],

    [0, 5], [5, 6], [6, 7], [7, 8],

    [5, 9], [9, 10], [10, 11], [11, 12],

    [9, 13], [13, 14], [14, 15], [15, 16],

    [13, 17], [17, 18], [18, 19], [19, 20],

    [0, 17]

];


// =====================================================
// 5. INITIALISE MEDIAPIPE
// =====================================================

async function initializeHandTracking() {

    console.log("KIANA: Initialising holographic vision...");

    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    const modelOptions = {

        baseOptions: {

            modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",

            delegate: "GPU"

        },

        runningMode: "VIDEO",

        numHands: 2,

        minHandDetectionConfidence: 0.65,

        minHandPresenceConfidence: 0.65,

        minTrackingConfidence: 0.65

    };

    try {

        handLandmarker = await HandLandmarker.createFromOptions(
            vision,
            modelOptions
        );

    } catch (gpuError) {

        console.warn(
            "KIANA: GPU unavailable. Switching to CPU.",
            gpuError
        );

        modelOptions.baseOptions.delegate = "CPU";

        handLandmarker = await HandLandmarker.createFromOptions(
            vision,
            modelOptions
        );

    }

    console.log("KIANA: Vision system online.");

    window.elementaTrackingReady = true;

    document.dispatchEvent(
        new Event("elementa-tracking-ready")
    );

    startDetectionLoop();

}


// =====================================================
// 6. DRAW HAND LANDMARKS
// =====================================================

function drawHand(landmarks) {

    if (!ctx || !canvas) return;

    ctx.beginPath();

    ctx.strokeStyle = "#62aaff";

    ctx.lineWidth = Math.max(2, canvas.width / 160);

    ctx.lineCap = "round";

    ctx.lineJoin = "round";

    connections.forEach(([start, end]) => {

        const pointA = landmarks[start];

        const pointB = landmarks[end];

        ctx.moveTo(
            pointA.x * canvas.width,
            pointA.y * canvas.height
        );

        ctx.lineTo(
            pointB.x * canvas.width,
            pointB.y * canvas.height
        );

    });

    ctx.stroke();

    landmarks.forEach(point => {

        ctx.beginPath();

        ctx.arc(
            point.x * canvas.width,
            point.y * canvas.height,
            Math.max(3, canvas.width / 100),
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#a78bfa";

        ctx.fill();

    });

}


// =====================================================
// 7. SMOOTH HOLOGRAPHIC CURSOR
// =====================================================

function smoothCursor(targetX, targetY) {

    if (smoothedX === null || smoothedY === null) {

        smoothedX = targetX;

        smoothedY = targetY;

        return;

    }

    const differenceX = targetX - smoothedX;

    const differenceY = targetY - smoothedY;

    const distance = Math.hypot(
        differenceX,
        differenceY
    );

    // Ignore extremely small movements.
    if (distance < CURSOR_DEAD_ZONE) {
        return;
    }

    let smoothing;

    // Small movements: prioritise stability.
    if (distance < 12) {

        smoothing = CURSOR_SLOW_SMOOTHING;

    }

    // Medium movements: balanced response.
    else if (distance < 70) {

        smoothing = CURSOR_NORMAL_SMOOTHING;

    }

    // Large movements: respond faster.
    else {

        smoothing = CURSOR_FAST_SMOOTHING;

    }

    smoothedX += differenceX * smoothing;

    smoothedY += differenceY * smoothing;

}


// =====================================================
// 8. INTERACTIVE ELEMENT DETECTION
// =====================================================

function getInteractiveElementAtCursor() {

    if (smoothedX === null || smoothedY === null) {
        return null;
    }

    if (detailsPanel?.classList.contains("active")) {

        const closeButton =
            detailsPanel.querySelector(".close-details");

        if (closeButton) {

            const rect = closeButton.getBoundingClientRect();

            const inside =

                smoothedX >= rect.left &&
                smoothedX <= rect.right &&
                smoothedY >= rect.top &&
                smoothedY <= rect.bottom;

            if (inside) return closeButton;

        }

    }

    const elementsAtPoint = document.elementsFromPoint(
        smoothedX,
        smoothedY
    );

    for (const element of elementsAtPoint) {

        if (
            element === gestureCursor ||
            element === canvas ||
            element === webcam
        ) {
            continue;
        }

        const interactive = element.closest(
            "button:not(:disabled), a[href], [role='button'], input:not(:disabled), select:not(:disabled)"
        );

        if (interactive) return interactive;

    }

    return null;

}


// =====================================================
// 9. HOVER DETECTION
// =====================================================

function updateHoveredElement() {

    if (smoothedX === null || smoothedY === null) {
        return;
    }

    const interactiveElement = getInteractiveElementAtCursor();

    if (currentHoveredCard !== interactiveElement) {

        if (currentHoveredCard) {

            currentHoveredCard.classList.remove("gesture-selected");

            currentHoveredCard.classList.remove("gesture-hovered");

        }

        currentHoveredCard = interactiveElement;

        hoverFrames = 0;

        if (currentHoveredCard) {

            currentHoveredCard.classList.add("gesture-hovered");

            if (
                currentHoveredCard.classList.contains("element-card") ||
                currentHoveredCard.classList.contains("kiana-element-card")
            ) {

                currentHoveredCard.classList.add("gesture-selected");

            }

        }

    } else if (currentHoveredCard) {

        hoverFrames++;

    }

}


// =====================================================
// 10. LEFT HAND — DISCOVERY GRID SCROLLING
// =====================================================

function controlLeftHandScroll(hand) {

    if (!hand || !kianaGrid) return;

    if (
        kianaGrid.scrollHeight <= kianaGrid.clientHeight
    ) {

        previousLeftY = null;

        smoothedLeftY = null;

        return;

    }

    const workspace = document.querySelector(".kiana-workspace");

    if (
        workspace &&
        getComputedStyle(workspace).display === "none"
    ) {

        previousLeftY = null;

        smoothedLeftY = null;

        return;

    }

    const indexTipY = hand[8].y;

    if (smoothedLeftY === null) {

        smoothedLeftY = indexTipY;

        previousLeftY = indexTipY;

        return;

    }

    smoothedLeftY +=
        (indexTipY - smoothedLeftY) * 0.45;

    if (previousLeftY === null) {

        previousLeftY = smoothedLeftY;

        return;

    }

    const movement = previousLeftY - smoothedLeftY;

    previousLeftY = smoothedLeftY;

    if (Math.abs(movement) < SCROLL_DEAD_ZONE) {
        return;
    }

    const scrollAmount = Math.max(

        -MAX_SCROLL_PER_FRAME,

        Math.min(
            MAX_SCROLL_PER_FRAME,
            movement * canvas.height * SCROLL_SENSITIVITY
        )

    );

    kianaGrid.scrollTop += scrollAmount;

    if (gestureReadout) {

        gestureReadout.textContent =
            "LEFT HAND · DISCOVERY GRID SCROLLING";

    }

}


// =====================================================
// 11. RIGHT HAND — HOLOGRAPHIC CURSOR
// =====================================================

function moveGestureCursor(hand) {

    if (!canvas || !gestureCursor) return;

    const indexTip = hand[8];

    const rect = canvas.getBoundingClientRect();

    const targetX =
        rect.left + (1 - indexTip.x) * rect.width;

    const targetY =
        rect.top + indexTip.y * rect.height;

    smoothCursor(targetX, targetY);

    gestureCursor.style.left = `${smoothedX}px`;

    gestureCursor.style.top = `${smoothedY}px`;

    gestureCursor.classList.add("is-visible");

    updateHoveredElement();

}


// =====================================================
// 12. ELEMENT DETAILS CLOSING
// =====================================================

function isDetailsOpen() {

    return Boolean(
        detailsPanel &&
        detailsPanel.classList.contains("active")
    );

}


function closeDetailsWithGesture() {

    if (!isDetailsOpen()) return;

    if (typeof window.closeElementDetails === "function") {

        window.closeElementDetails();

    } else {

        detailsPanel.classList.remove("active");

        detailsPanel.setAttribute("aria-hidden", "true");

        document.body.classList.remove("element-details-open");

    }

    if (gestureReadout) {

        gestureReadout.textContent =
            "ELEMENT DETAILS CLOSED";

    }

    if (pinchStatus) {

        pinchStatus.textContent =
            "Ready for the next element";

    }

    console.log("KIANA: Element details closed by gesture.");

}


// =====================================================
// 13. RIGHT HAND — SWIPE DOWN TO CLOSE
// =====================================================

function detectSwipeDown(hand) {

    const now = performance.now();

    const wristY = hand[0].y;

    if (now - lastSwipeTime < SWIPE_COOLDOWN) {

        previousWristY = wristY;

        return;

    }

    if (previousWristY === null) {

        previousWristY = wristY;

        return;

    }

    const movement = wristY - previousWristY;

    previousWristY = wristY;

    if (movement > 0.025 && swipeStartY === null) {

        swipeStartY = wristY - movement;

        swipeStartTime = now;

    }

    if (swipeStartY === null) return;

    const totalMovement = wristY - swipeStartY;

    const duration = now - swipeStartTime;

    if (duration > SWIPE_MAX_DURATION) {

        swipeStartY = null;

        swipeStartTime = 0;

        return;

    }

    if (
        totalMovement >= SWIPE_DOWN_DISTANCE &&
        isDetailsOpen()
    ) {

        closeDetailsWithGesture();

        lastSwipeTime = now;

        swipeStartY = null;

        swipeStartTime = 0;

    }

}


// =====================================================
// 14. RESET SWIPE DETECTION
// =====================================================

function resetSwipeDetection() {

    previousWristY = null;

    swipeStartY = null;

    swipeStartTime = 0;

}


// =====================================================
// 15. HIDE HOLOGRAPHIC CURSOR
// =====================================================

function hideGestureCursor() {

    if (gestureCursor) {

        gestureCursor.classList.remove("is-visible");

        gestureCursor.classList.remove("is-pinching");

    }

    if (currentHoveredCard) {

        currentHoveredCard.classList.remove("gesture-selected");

        currentHoveredCard.classList.remove("gesture-hovered");

        currentHoveredCard = null;

    }

    smoothedX = null;

    smoothedY = null;

    hoverFrames = 0;

}


// =====================================================
// 16. RIGHT HAND — PINCH TO SELECT
// =====================================================

function detectPinch(hand) {

    if (!gestureCursor) return;

    const thumbTip = hand[4];

    const indexTip = hand[8];

    const pinchDistance = Math.hypot(

        thumbTip.x - indexTip.x,

        thumbTip.y - indexTip.y

    );

    // ---------------------------------------------
    // PINCH START CONFIRMATION
    // ---------------------------------------------

    if (pinchDistance < PINCH_START_DISTANCE) {

        pinchStartFrames++;

        pinchReleaseFrames = 0;

        if (
            pinchStartFrames >= REQUIRED_PINCH_START_FRAMES &&
            !isPinching
        ) {

            isPinching = true;

            gestureCursor.classList.add("is-pinching");

            // Pinch closes open element details.
            if (isDetailsOpen()) {

                closeDetailsWithGesture();

                return;

            }

            if (currentHoveredCard && hoverFrames >= 2) {

                const selectedControl = currentHoveredCard;

                if (!selectedControl.isConnected) return;

                if (selectedControl.matches("input")) {

                    if (pinchStatus) {

                        pinchStatus.textContent =
                            "Search input is currently unavailable";

                    }

                    return;

                }

                selectedControl.click();

                const symbol = selectedControl.querySelector(
                    ".element-symbol, .kiana-card-symbol"
                );

                if (pinchStatus) {

                    pinchStatus.textContent = symbol

                        ? `Selected ${symbol.textContent}!`

                        : "Holographic selection confirmed";

                }

                console.log(
                    "KIANA: Gesture selection confirmed.",
                    selectedControl
                );

            } else if (pinchStatus) {

                pinchStatus.textContent =
                    "Point at a holographic control before pinching.";

            }

        }

        return;

    }

    // ---------------------------------------------
    // PINCH RELEASE CONFIRMATION
    // ---------------------------------------------

    if (pinchDistance > PINCH_RELEASE_DISTANCE) {

        pinchReleaseFrames++;

        pinchStartFrames = 0;

        if (
            pinchReleaseFrames >= REQUIRED_PINCH_RELEASE_FRAMES &&
            isPinching
        ) {

            isPinching = false;

            gestureCursor.classList.remove("is-pinching");

            if (pinchStatus) {

                pinchStatus.textContent =
                    "Pinch released · Ready for selection";

            }

        }

    }

}


// =====================================================
// 17. RESET PINCH
// =====================================================

function resetPinch() {

    isPinching = false;

    pinchStartFrames = 0;

    pinchReleaseFrames = 0;

    if (gestureCursor) {

        gestureCursor.classList.remove("is-pinching");

    }

    if (pinchStatus) {

        pinchStatus.textContent =
            "Pinch your thumb and index finger to select";

    }

}


// =====================================================
// 18. MEASURE DISTANCE BETWEEN TWO HANDS
// =====================================================

function measureHandDistance(landmarks) {

    if (!landmarks || landmarks.length < 2) return 0;

    const handA = landmarks[0];

    const handB = landmarks[1];

    const pointA = handA[9];

    const pointB = handB[9];

    return Math.hypot(

        pointA.x - pointB.x,

        pointA.y - pointB.y

    );

}


// =====================================================
// 19. TWO-HAND EXPAND AND COLLAPSE
// =====================================================

function controlPeriodicTable(distance) {

    const targetGrid = kianaGrid || periodicGrid;

    if (!targetGrid) return;

    if (
        distance > EXPAND_DISTANCE &&
        !tableExpanded
    ) {

        expandFrames++;

        collapseFrames = 0;

        if (expandFrames >= REQUIRED_EXPAND_FRAMES) {

            tableExpanded = true;

            targetGrid.classList.add("gesture-expanded");

            if (gestureReadout) {

                gestureReadout.textContent =
                    "HOLOGRAPHIC PANEL EXPANDED";

            }

            expandFrames = 0;

        }

    } else if (
        distance < COLLAPSE_DISTANCE &&
        tableExpanded
    ) {

        collapseFrames++;

        expandFrames = 0;

        if (collapseFrames >= REQUIRED_COLLAPSE_FRAMES) {

            tableExpanded = false;

            targetGrid.classList.remove("gesture-expanded");

            if (gestureReadout) {

                gestureReadout.textContent =
                    "HOLOGRAPHIC PANEL COLLAPSED";

            }

            collapseFrames = 0;

        }

    } else {

        expandFrames = 0;

        collapseFrames = 0;

    }

}


// =====================================================
// 20. RESET TWO-HAND STATE
// =====================================================

function resetTwoHandGesture() {

    expandFrames = 0;

    collapseFrames = 0;

}


// =====================================================
// 21. IDENTIFY PHYSICAL HAND
// =====================================================

function getPhysicalHandedness(results, index) {

    const rawLabel =
        results.handednesses?.[index]?.[0]?.categoryName;

    if (!rawLabel) return null;

    if (rawLabel === "Left") return "Right";

    if (rawLabel === "Right") return "Left";

    return null;

}


// =====================================================
// 22. PROCESS HAND RESULTS
// =====================================================

function processHandResults(results) {

    latestResults = results;

    const detectedHands = results.landmarks || [];

    latestHandLabels = detectedHands.map((hand, index) => ({

        index,

        rawLabel:
            results.handednesses?.[index]?.[0]?.categoryName || "Unknown",

        physicalLabel:
            getPhysicalHandedness(results, index)

    }));

    if (detectedHands.length === 0) {

        handleNoHands();

        return;

    }

    noHandFrames = 0;

    if (detectedHands.length !== lastHandCount) {

        resetPinch();

        previousLeftY = null;

        smoothedLeftY = null;

        resetSwipeDetection();

        resetTwoHandGesture();

        lastHandCount = detectedHands.length;

    }

    let rightHand = null;

    let leftHand = null;

    detectedHands.forEach((hand, index) => {

        const physicalHand = getPhysicalHandedness(
            results,
            index
        );

        if (physicalHand === "Right") {

            rightHand = hand;

        }

        if (physicalHand === "Left") {

            leftHand = hand;

        }

    });

    // RIGHT HAND: CURSOR AND PINCH.

    if (rightHand) {

        moveGestureCursor(rightHand);

        detectPinch(rightHand);

        if (!isPinching) {

            detectSwipeDown(rightHand);

        }

    } else {

        hideGestureCursor();

        resetPinch();

        resetSwipeDetection();

    }

    // LEFT HAND: GRID SCROLL.

    if (leftHand) {

        controlLeftHandScroll(leftHand);

    } else {

        previousLeftY = null;

        smoothedLeftY = null;

    }

    // BOTH HANDS: EXPAND AND COLLAPSE.

    if (detectedHands.length === 2) {

        const distance = measureHandDistance(
            detectedHands
        );

        const distancePercentage = Math.round(
            distance * 100
        );

        controlPeriodicTable(distance);

        if (gestureReadout) {

            gestureReadout.textContent =
                `BOTH HANDS ACTIVE · DISTANCE ${distancePercentage}%`;

        }

        return;

    }

    // ONE-HAND STATUS.

    if (gestureReadout && !isDetailsOpen()) {

        if (rightHand) {

            gestureReadout.textContent =
                "RIGHT HAND · HOLOGRAPHIC CURSOR ACTIVE";

        } else if (leftHand) {

            gestureReadout.textContent =
                "LEFT HAND · ELEMENT GRID SCROLL ACTIVE";

        } else {

            gestureReadout.textContent =
                "HAND SIDE UNKNOWN · ADJUST YOUR HAND POSITION";

        }

    }

}


// =====================================================
// 23. NO HAND DETECTED
// =====================================================

function handleNoHands() {

    noHandFrames++;

    if (noHandFrames <= NO_HAND_GRACE_FRAMES) {
        return;
    }

    hideGestureCursor();

    resetPinch();

    resetSwipeDetection();

    resetTwoHandGesture();

    previousLeftY = null;

    smoothedLeftY = null;

    if (lastHandCount !== 0) {

        if (gestureReadout) {

            gestureReadout.textContent =
                "NO HANDS DETECTED · SHOW YOUR HAND";

        }

        if (pinchStatus) {

            pinchStatus.textContent =
                "Show your hand to begin";

        }

    }

    lastHandCount = 0;

    latestHandLabels = [];

}


// =====================================================
// 24. RESET TRACKING
// =====================================================

function resetTracking() {

    if (
        lastHandCount !== 0 ||
        smoothedX !== null ||
        isPinching
    ) {

        hideGestureCursor();

        resetPinch();

        resetSwipeDetection();

        resetTwoHandGesture();

        previousLeftY = null;

        smoothedLeftY = null;

        lastHandCount = 0;

        latestHandLabels = [];

        latestResults = null;

        noHandFrames = 0;

        if (ctx && canvas) {

            ctx.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

        }

    }

}


// =====================================================
// 25. DETECTION LOOP
// =====================================================

function detectHands() {

    animationFrameId = requestAnimationFrame(detectHands);

    if (
        !handLandmarker ||
        !webcam ||
        !webcam.srcObject ||
        webcam.readyState < 2 ||
        webcam.videoWidth === 0
    ) {

        resetTracking();

        return;

    }

    if (webcam.currentTime === lastVideoTime) {
        return;
    }

    lastVideoTime = webcam.currentTime;

    if (
        canvas.width !== webcam.videoWidth ||
        canvas.height !== webcam.videoHeight
    ) {

        canvas.width = webcam.videoWidth;

        canvas.height = webcam.videoHeight;

    }

    try {

        const results = handLandmarker.detectForVideo(
            webcam,
            performance.now()
        );

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        const detectedHands = results.landmarks || [];

        detectedHands.forEach(hand => {

            drawHand(hand);

        });

        processHandResults(results);

        trackingErrorShown = false;

    } catch (error) {

        if (!trackingErrorShown) {

            console.error(
                "KIANA tracking error:",
                error
            );

            trackingErrorShown = true;

        }

    }

}


// =====================================================
// 26. START DETECTION LOOP
// =====================================================

function startDetectionLoop() {

    if (animationFrameId !== null) {
        return;
    }

    lastVideoTime = -1;

    detectHands();

}


// =====================================================
// 27. CAMERA EVENT SUPPORT
// =====================================================

document.addEventListener(
    "kiana-camera-stopped",
    () => {

        resetTracking();

        if (ctx && canvas) {

            ctx.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

        }

    }
);


// =====================================================
// 28. INITIALISE KIANA
// =====================================================

initializeHandTracking().catch(error => {

    console.error(
        "KIANA hand tracking failed:",
        error
    );

    window.elementaTrackingReady = false;

    if (gestureReadout) {

        gestureReadout.textContent =
            "VISION SYSTEM ERROR · CHECK CONSOLE";

    }

});


// =====================================================
// 29. SYSTEM STATUS
// =====================================================

console.log("--------------------------------");

console.log("ELEMENTA × KIANA");

console.log("Holographic Gesture Engine");

console.log("Right hand: Cursor and pinch selection");

console.log("Left hand: Direct discovery grid scrolling");

console.log("Both hands: Expand and collapse");

console.log("Adaptive cursor smoothing enabled");

console.log("Stable pinch detection enabled");

console.log("--------------------------------");
