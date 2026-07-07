import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

class BrowserDetector {
  constructor() {
    this.landmarker = null;
    this.stream = null;
    this.animationFrameId = null;
    
    // Configurable thresholds
    this.earThreshold = 0.21;
    this.restingBpm = 15.0;
    
    // State metrics matching Python EyeDetector
    this.consecutiveClosedFrames = 0;
    this.blinkTimestamps = []; // timestamps of blinks in last 60s
    this.bpm = 15.0;
    this.totalBlinks = 0;
    
    this.isCalibrating = false;
    this.calibrationStartTime = null;
    this.calibrationEars = [];
    this.calibrationDistances = [];
    
    this.rollingEars = []; // max length 300
    this.baselineEyeDistance = 100.0;
    
    this.currentEar = 0.0;
    this.currentPerclos = 0.0;
    this.currentCloseness = 1.0;
    this.headPitch = 0.0;
    this.headYaw = 0.0;
    this.headRoll = 0.0;
    this.ambientBrightness = 120.0;
    this.faceDetected = false;
    this.lastFaceSeenTime = Date.now();
    
    this.eyeStateHistory = []; // max length 900
    
    // Landmark indices
    this.LEFT_EYE = [33, 160, 158, 133, 153, 144];
    this.RIGHT_EYE = [362, 385, 387, 263, 373, 380];
    
    // Offscreen canvas for brightness calculation
    this.brightnessCanvas = null;
    this.brightnessCtx = null;
  }

  async initialize() {
    if (this.landmarker) return;
    
    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
    );
    
    this.landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU"
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
      numFaces: 1
    });
  }

  _euclideanDist(p1, p2) {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) + 
      Math.pow(p1.y - p2.y, 2) + 
      Math.pow(p1.z - p2.z, 2)
    );
  }

  calculateEar(landmarks, eyeIndices, width, height) {
    // Get absolute pixel coordinates matching Python behavior (where they were scaled by w, h)
    const pts = eyeIndices.map(idx => {
      const lm = landmarks[idx];
      return {
        x: lm.x * width,
        y: lm.y * height,
        z: lm.z * width
      };
    });
    
    const v1 = this._euclideanDist(pts[1], pts[5]);
    const v2 = this._euclideanDist(pts[2], pts[4]);
    const h = this._euclideanDist(pts[0], pts[3]);
    
    if (h === 0.0) return 0.0;
    return (v1 + v2) / (2.0 * h);
  }

  estimateHeadPose(landmarks, width, height) {
    // Coordinates scaled to width / height matching Python logic
    const pts = [1, 152, 33, 263, 10].reduce((acc, idx) => {
      const lm = landmarks[idx];
      acc[idx] = {
        x: lm.x * width,
        y: lm.y * height,
        z: lm.z * width
      };
      return acc;
    }, {});
    
    // 1. Roll: Angle of eye corners
    const dx = pts[263].x - pts[33].x;
    const dy = pts[263].y - pts[33].y;
    this.headRoll = Math.atan2(dy, dx) * 180 / Math.PI;
    
    // 2. Yaw: Ratio of Nose-to-Left-Eye vs Nose-to-Right-Eye
    const distLeft = this._euclideanDist(pts[1], pts[33]);
    const distRight = this._euclideanDist(pts[1], pts[263]);
    if (distRight > 0) {
      const yawRatio = distLeft / distRight;
      this.headYaw = (yawRatio - 1.0) * 45.0;
      this.headYaw = Math.max(-90.0, Math.min(90.0, this.headYaw));
    }
    
    // 3. Pitch: Ratio of (Nose-to-Forehead) vs (Nose-to-Chin)
    const distForehead = this._euclideanDist(pts[1], pts[10]);
    const distChin = this._euclideanDist(pts[1], pts[152]);
    if (distChin > 0) {
      const pitchRatio = distForehead / distChin;
      this.headPitch = (pitchRatio - 1.0) * 35.0;
      this.headPitch = Math.max(-90.0, Math.min(90.0, this.headPitch));
    }
  }

  calculateBrightness(videoEl) {
    if (!this.brightnessCanvas) {
      this.brightnessCanvas = document.createElement('canvas');
      this.brightnessCanvas.width = 32;
      this.brightnessCanvas.height = 24;
      this.brightnessCtx = this.brightnessCanvas.getContext('2d');
    }
    try {
      this.brightnessCtx.drawImage(videoEl, 0, 0, 32, 24);
      const imgData = this.brightnessCtx.getImageData(0, 0, 32, 24).data;
      let sum = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i+1];
        const b = imgData[i+2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        sum += gray;
      }
      this.ambientBrightness = sum / (imgData.length / 4);
    } catch (e) {
      console.warn("Failed to calculate brightness", e);
    }
  }

  getStrainScore() {
    if (!this.faceDetected) return 0;
    
    let bpmStrain = 0.0;
    if (this.bpm < 12) {
      bpmStrain = ((12.0 - this.bpm) / 12.0) * 100.0;
    }
    
    const perclosStrain = this.currentPerclos * 200.0;
    
    let closenessStrain = 0.0;
    if (this.currentCloseness > 1.25) {
      closenessStrain = (this.currentCloseness - 1.25) * 150.0;
    }
    
    let brightnessStrain = 0.0;
    if (this.ambientBrightness < 50.0) {
      brightnessStrain = ((50.0 - this.ambientBrightness) / 50.0) * 50.0;
    }
    
    const score = (0.5 * bpmStrain) + (0.3 * perclosStrain) + (0.1 * closenessStrain) + (0.1 * brightnessStrain);
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  processFrame(videoEl, timestamp, callback) {
    if (!this.landmarker || videoEl.paused || videoEl.ended) return null;
    
    const width = videoEl.videoWidth;
    const height = videoEl.videoHeight;
    if (width === 0 || height === 0) return null;
    
    // 1. Calculate brightness
    this.calculateBrightness(videoEl);
    
    // 2. Perform landmark detection
    const results = this.landmarker.detectForVideo(videoEl, timestamp);
    let blinkDetected = false;
    
    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      this.faceDetected = true;
      this.lastFaceSeenTime = Date.now();
      
      const landmarks = results.faceLandmarks[0];
      
      // Calculate EAR for left and right eyes
      const leftEar = this.calculateEar(landmarks, this.LEFT_EYE, width, height);
      const rightEar = this.calculateEar(landmarks, this.RIGHT_EYE, width, height);
      const avgEar = (leftEar + rightEar) / 2.0;
      this.currentEar = avgEar;
      
      this.rollingEars.push(avgEar);
      if (this.rollingEars.length > 300) this.rollingEars.shift();
      
      // Distance estimation for screen closeness: outer corners of eyes (landmarks 33 and 263)
      const leftCorner = {
        x: landmarks[33].x * width,
        y: landmarks[33].y * height,
        z: landmarks[33].z * width
      };
      const rightCorner = {
        x: landmarks[263].x * width,
        y: landmarks[263].y * height,
        z: landmarks[263].z * width
      };
      const eyeDist = this._euclideanDist(leftCorner, rightCorner);
      this.currentCloseness = eyeDist / this.baselineEyeDistance;
      
      // Estimate Head Pose
      this.estimateHeadPose(landmarks, width, height);
      
      // Calibration gathering
      if (this.isCalibrating) {
        this.calibrationEars.push(avgEar);
        this.calibrationDistances.push(eyeDist);
      }
      
      // Blink Detection State Machine
      const isClosed = avgEar < this.earThreshold;
      this.eyeStateHistory.push(isClosed ? 1 : 0);
      if (this.eyeStateHistory.length > 900) this.eyeStateHistory.shift();
      
      if (isClosed) {
        this.consecutiveClosedFrames += 1;
      } else {
        // If eyes were closed for 2 to 10 consecutive frames, it's a blink.
        if (this.consecutiveClosedFrames >= 2 && this.consecutiveClosedFrames <= 10) {
          blinkDetected = true;
          this.blinkTimestamps.push(Date.now());
          this.totalBlinks += 1;
        }
        this.consecutiveClosedFrames = 0;
      }
    } else {
      // Face not detected
      if (Date.now() - this.lastFaceSeenTime > 5000) {
        this.faceDetected = false;
      }
      this.currentEar = 0.0;
      this.consecutiveClosedFrames = 0;
    }
    
    // Clean up old blinks (older than 60s)
    const now = Date.now();
    this.blinkTimestamps = this.blinkTimestamps.filter(t => (now - t) < 60000);
    
    if (this.faceDetected) {
      this.bpm = this.blinkTimestamps.length;
    }
    
    if (this.eyeStateHistory.length > 0) {
      this.currentPerclos = this.eyeStateHistory.reduce((s, v) => s + v, 0) / this.eyeStateHistory.length;
    } else {
      this.currentPerclos = 0.0;
    }
    
    // Handle calibration check
    if (this.isCalibrating) {
      const elapsed = (Date.now() - this.calibrationStartTime) / 1000;
      const remaining = Math.max(0, 15 - Math.floor(elapsed));
      if (remaining <= 0) {
        this.finishCalibration();
        if (callback) {
          callback({
            event: "calibration_complete",
            earThreshold: this.earThreshold,
            baselineEyeDistance: this.baselineEyeDistance
          });
        }
      } else {
        if (callback) {
          callback({
            event: "calibration_progress",
            secondsLeft: remaining
          });
        }
      }
    }
    
    if (blinkDetected && callback) {
      callback({
        event: "blink",
        bpm: this.bpm
      });
    }
    
    // Return frame update payload
    return {
      timestamp: new Date().toISOString(),
      bpm: this.bpm,
      totalBlinks: this.totalBlinks,
      ear: parseFloat(this.currentEar.toFixed(3)),
      perclos: parseFloat(this.currentPerclos.toFixed(3)),
      strainScore: this.getStrainScore(),
      faceDetected: this.faceDetected,
      alertActive: this.bpm < 12 && this.faceDetected,
      headPose: {
        pitch: parseFloat(this.headPitch.toFixed(1)),
        yaw: parseFloat(this.headYaw.toFixed(1)),
        roll: parseFloat(this.headRoll.toFixed(1))
      },
      closeness: parseFloat(this.currentCloseness.toFixed(2)),
      brightness: parseFloat(this.ambientBrightness.toFixed(1)),
      rawLandmarks: results.faceLandmarks && results.faceLandmarks.length > 0 ? results.faceLandmarks[0] : null
    };
  }

  startCalibration() {
    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    this.calibrationEars = [];
    this.calibrationDistances = [];
  }

  finishCalibration() {
    this.isCalibrating = false;
    if (this.calibrationEars.length === 0) return;
    
    // Sort array to get median
    const sortedEars = [...this.calibrationEars].sort((a, b) => a - b);
    const mid = Math.floor(sortedEars.length / 2);
    const medianEar = sortedEars.length % 2 !== 0 ? sortedEars[mid] : (sortedEars[mid - 1] + sortedEars[mid]) / 2.0;
    
    this.earThreshold = Math.max(0.15, Math.min(0.25, medianEar * 0.72));
    
    const sumDist = this.calibrationDistances.reduce((s, v) => s + v, 0);
    const meanDist = sumDist / this.calibrationDistances.length;
    if (meanDist > 0) {
      this.baselineEyeDistance = meanDist;
    }
  }
}

export default BrowserDetector;
