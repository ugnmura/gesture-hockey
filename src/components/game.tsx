"use client";
import { Application, extend } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import React, { useCallback, useEffect, useRef } from "react";
import {
  getHandCentersOnce,
  ensureRecognizer,
  ReadyStateVideo,
} from "@/utils/mediapipe";
import { getURL } from "@/utils/api";

import Matter, { Engine, World, Bodies, Body } from "matter-js";

extend({ Container, Graphics, Text });

const WIDTH = 640 * 2;
const HEIGHT = 480 * 2;
const WIN_SCORE = 10;
const PADDLE_SIZE = 50;
const PUCK_SIZE = 22;
const SPEED_CAP = 15;

type GRef = React.RefObject<any>;

const makeCircleDraw = (color: number, r: number) => (g: Graphics) => {
  g.clear();
  g.setFillStyle({ color });
  g.circle(0, 0, r);
  g.fill();
};

const Game: React.FC = () => {
  useEffect(() => {
    const load = async () => {
      try {
        await document.fonts.load('128px "Press Start 2P"');
        console.log("Font loaded!");
      } catch (err) {
        console.error("Font failed to load", err);
      }
    };

    load();
  }, []);
  const puckG = useRef<any>(null);
  const p1G = useRef<any>(null);
  const p2G = useRef<any>(null);
  const videoRef = useRef<ReadyStateVideo>(null);

  const engineRef = useRef<Engine | null>(null);
  const puckRef = useRef<Matter.Body | null>(null);
  const p1Ref = useRef<Matter.Body | null>(null);
  const p2Ref = useRef<Matter.Body | null>(null);

  const leftGoalRef = useRef<Matter.Body | null>(null);
  const rightGoalRef = useRef<Matter.Body | null>(null);
  const scoreRef = useRef({ left: 0, right: 0 });
  const respawningRef = useRef(false);

  const leftScoreTextRef = useRef<any>(null);
  const rightScoreTextRef = useRef<any>(null);

  const drawPuck = useCallback(makeCircleDraw(0xffff00, PUCK_SIZE), []);
  const drawPaddleBlue = useCallback(makeCircleDraw(0xff4444, PADDLE_SIZE), []);
  const drawPaddleGray = useCallback(makeCircleDraw(0x44aaff, PADDLE_SIZE), []);

  const winnerRef = useRef<"left" | "right" | null>(null);
  const winBannerRef = useRef<any>(null);

  const handleWin = (side: "left" | "right") => {
    winnerRef.current = side;
    if (engineRef.current) engineRef.current.timing.timeScale = 0;
    if (puckG.current) puckG.current.visible = false;
    if (winBannerRef.current) {
      winBannerRef.current.text = side === "left" ? "RED WINS!" : "BLUE WINS!";
      winBannerRef.current.style.fill =
        side === "left" ? "0xFFAAAA" : "0xAAAAFF";
      winBannerRef.current.visible = true;
    }
  };

  const handleRespawn = (
    puck: Matter.Body,
    puckG: GRef,
    side: "right" | "left",
  ) => {
    if (!puck || !puckG.current) return;
    respawningRef.current = true;

    puckG.current.visible = false;

    Body.setVelocity(puck, { x: 0, y: 0 });
    Body.setAngularVelocity(puck, 0);
    Body.setAngle(puck, 0);
    if (side === "left") {
      Body.setPosition(puck, { x: WIDTH / 4, y: HEIGHT / 2 });
    } else {
      Body.setPosition(puck, { x: (3 * WIDTH) / 4, y: HEIGHT / 2 });
    }
    Body.setStatic(puck, true);

    setTimeout(() => {
      if (puckG.current) {
        puckG.current.visible = true;
      }
      respawningRef.current = false;

      setTimeout(() => {
        Body.setStatic(puck, false);
      }, 500);
    }, 500);
  };

  const audioCtxRef = useRef<AudioContext | null>(null);
  const hitBufferRef = useRef<AudioBuffer | null>(null);
  const goalBufferRef = useRef<AudioBuffer | null>(null);
  const winBufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    fetch(getURL("/hit.wav"))
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        hitBufferRef.current = decoded;
      });

    fetch(getURL("/goal.wav"))
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        goalBufferRef.current = decoded;
      });

    fetch(getURL("/win.wav"))
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        winBufferRef.current = decoded;
      });
  }, []);

  const playHitSound = (pitch = 1) => {
    const ctx = audioCtxRef.current;
    const buffer = hitBufferRef.current;
    if (!ctx || !buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = pitch;

    source.connect(ctx.destination);
    source.start(0);
  };

  const playGoalSound = () => {
    const ctx = audioCtxRef.current;
    const buffer = goalBufferRef.current;
    if (!ctx || !buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  };

  const playWinSound = () => {
    const ctx = audioCtxRef.current;
    const buffer = winBufferRef.current;
    if (!ctx || !buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  };

  useEffect(() => {
    const engine = Engine.create({ enableSleeping: false });
    engine.gravity.y = 0;

    const wallOpts = {
      isStatic: true,
      restitution: 1,
      friction: 0,
      frictionAir: 0,
    };
    const walls = [
      Bodies.rectangle(WIDTH / 2, -5, WIDTH, 10, wallOpts),
      Bodies.rectangle(WIDTH / 2, HEIGHT + 5, WIDTH, 10, wallOpts),
      Bodies.rectangle(-5, HEIGHT / 2, 10, HEIGHT, wallOpts),
      Bodies.rectangle(WIDTH + 5, HEIGHT / 2, 10, HEIGHT, wallOpts),
    ];

    const puck = Bodies.circle(WIDTH / 2, HEIGHT / 2, PUCK_SIZE, {
      label: "puck",
      restitution: 0.98,
      friction: 0,
      frictionAir: 0.005,
      density: 0.0015,
    });

    const p1 = Bodies.circle(WIDTH * 0.25, HEIGHT / 2, PADDLE_SIZE, {
      label: "paddle-1",
      inertia: Infinity,
      frictionAir: 0.15,
      restitution: 0.5,
    });
    const p2 = Bodies.circle(WIDTH * 0.75, HEIGHT / 2, PADDLE_SIZE, {
      label: "paddle-2",
      inertia: Infinity,
      frictionAir: 0.15,
      restitution: 0.5,
    });

    const GOAL_H = HEIGHT * 0.4;
    const GOAL_Y = HEIGHT / 2;
    const SENSOR_W = 8;

    const leftGoal = Bodies.rectangle(4, GOAL_Y, SENSOR_W, GOAL_H, {
      isSensor: true,
      isStatic: true,
      label: "goal-left",
    });
    const rightGoal = Bodies.rectangle(WIDTH - 4, GOAL_Y, SENSOR_W, GOAL_H, {
      isSensor: true,
      isStatic: true,
      label: "goal-right",
    });

    World.add(engine.world, [...walls, puck, p1, p2, leftGoal, rightGoal]);

    engineRef.current = engine;
    puckRef.current = puck;
    p1Ref.current = p1;
    p2Ref.current = p2;
    leftGoalRef.current = leftGoal;
    rightGoalRef.current = rightGoal;

    Matter.Events.on(engine, "collisionStart", (ev) => {
      if (respawningRef.current) return;
      for (const pair of ev.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;

        const hasPuck = a.label === "puck" || b.label === "puck";
        if (!hasPuck) continue;

        const speed = Math.hypot(puck.velocity.x, puck.velocity.y);
        const pitch = 1 + speed / 25;
        playHitSound(pitch);

        const other = a.label === "puck" ? b : a;

        if (other.label === "goal-left") {
          scoreRef.current.right += 1;
          if (rightScoreTextRef.current)
            rightScoreTextRef.current.text = scoreRef.current.right.toString();
          if (scoreRef.current.right >= WIN_SCORE) {
            playWinSound();
            handleWin("right");
            break;
          } else {
            handleRespawn(puck, puckG, "left");
            playGoalSound();
          }
          break;
        }
        if (other.label === "goal-right") {
          scoreRef.current.left += 1;
          if (leftScoreTextRef.current)
            leftScoreTextRef.current.text = scoreRef.current.left.toString();
          if (scoreRef.current.left >= WIN_SCORE) {
            playWinSound();
            handleWin("left");
            break;
          } else {
            handleRespawn(puck, puckG, "right");
            playGoalSound();
          }
          break;
        }
      }
    });

    return () => {
      engineRef.current = null;
      puckRef.current = null;
      p1Ref.current = null;
      p2Ref.current = null;
      leftGoalRef.current = null;
      rightGoalRef.current = null;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const STEP = 1000 / 60;
    let last = performance.now();
    let acc = 0;

    const start = async () => {
      if (videoRef.current) {
        await ensureRecognizer(videoRef.current);
      }

      const tick = async (now: number) => {
        const eng = engineRef.current;
        if (!eng) {
          raf = requestAnimationFrame(tick);
          return;
        }

        let centers = [] as { x: number; y: number }[];
        try {
          centers = await getHandCentersOnce();
        } catch { }

        const [h1, h2] = centers;
        let left;
        let right;
        if ((h1 && h1.x < 0.5) || (h2 && h2.x > 0.5)) {
          left = h1;
          right = h2;
        } else {
          left = h2;
          right = h1;
        }
        if (p1Ref.current && right) {
          const tx = (1 - right.x) * WIDTH; // mirror
          const ty = right.y * HEIGHT;
          steerBodyToward(p1Ref.current, tx, ty);
          clampBodyPosition(p1Ref.current, 0, 0, WIDTH * 0.49, HEIGHT);
        }
        if (p2Ref.current && left) {
          const tx = (1 - left.x) * WIDTH;
          const ty = left.y * HEIGHT;
          steerBodyToward(p2Ref.current, tx, ty);
          clampBodyPosition(p2Ref.current, WIDTH * 0.51, 0, WIDTH, HEIGHT);
        }

        const dt = Math.min(50, now - last);
        acc += dt;
        while (acc >= STEP) {
          Engine.update(eng, STEP);
          acc -= STEP;

          if (puckRef.current) {
            const v = puckRef.current.velocity;
            const max = 22;
            const s = Math.hypot(v.x, v.y);
            if (s > max)
              Body.setVelocity(puckRef.current, {
                x: (v.x * max) / s,
                y: (v.y * max) / s,
              });
          }
        }
        last = now - acc;

        syncGraphic(puckG, puckRef);
        syncGraphic(p1G, p1Ref);
        syncGraphic(p2G, p2Ref);

        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
    };

    start();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="grid gap-2">
      <video
        className="scale-x-[-1] absolute opacity-35"
        width={WIDTH}
        height={HEIGHT}
        ref={videoRef}
        autoPlay
        muted
        playsInline
        disablePictureInPicture
      />

      <Application width={WIDTH} height={HEIGHT}>
        <pixiContainer>
          <pixiGraphics
            draw={(g: Graphics) => {
              g.clear();
              g.setStrokeStyle({ width: 2, color: 0x2e3a5a, alpha: 1 });
              g.moveTo(WIDTH / 2, 0);
              g.lineTo(WIDTH / 2, HEIGHT);
              g.stroke();
            }}
          />

          <pixiGraphics
            draw={(g: Graphics) => {
              g.clear();
              g.setFillStyle({ color: 0xff4444, alpha: 0.75 });
              g.rect(0, HEIGHT * 0.3, 10, HEIGHT * 0.4);
              g.fill();
            }}
          />

          <pixiGraphics
            draw={(g: Graphics) => {
              g.clear();
              g.setFillStyle({ color: 0x44aaff, alpha: 0.75 });
              g.rect(WIDTH - 10, HEIGHT * 0.3, 10, HEIGHT * 0.4);
              g.fill();
            }}
          />

          <pixiText
            ref={leftScoreTextRef}
            text="0"
            x={WIDTH / 4}
            y={HEIGHT / 2}
            anchor={{ x: 0.5, y: 0.5 }}
            style={{
              fill: 0x888888,
              fontSize: 256,
              fontFamily: "Press Start 2P",
              fontWeight: "700",
              letterSpacing: 1,
            }}
          />

          <pixiText
            ref={rightScoreTextRef}
            text="0"
            x={(3 * WIDTH) / 4}
            y={HEIGHT / 2}
            anchor={{ x: 0.5, y: 0.5 }}
            style={{
              fill: 0x888888,
              fontSize: 256,
              fontFamily: "Press Start 2P",
              fontWeight: "700",
              letterSpacing: 1,
            }}
          />

          <pixiText
            ref={winBannerRef}
            text=""
            x={WIDTH / 2}
            y={HEIGHT / 2}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={9999}
            visible={false}
            style={{
              fontSize: 96,
              fontFamily: "Press Start 2P",
              fontWeight: "700",
              letterSpacing: 2,
              dropShadow: true,
            }}
          />

          <pixiGraphics
            ref={puckG}
            draw={drawPuck}
            x={WIDTH / 2}
            y={HEIGHT / 2}
          />
          <pixiGraphics
            ref={p1G}
            draw={drawPaddleBlue}
            x={WIDTH * 0.25}
            y={HEIGHT / 2}
          />
          <pixiGraphics
            ref={p2G}
            draw={drawPaddleGray}
            x={WIDTH * 0.75}
            y={HEIGHT / 2}
          />
        </pixiContainer>
      </Application>
    </div>
  );
};

export default Game;

const syncGraphic = (
  gfxRef: GRef,
  bodyRef: React.RefObject<Matter.Body | null>,
) => {
  const g = gfxRef.current;
  const b = bodyRef.current;
  if (g && b) g.position.set(b.position.x, b.position.y);
};

const capVector = (vx: number, vy: number, max: number) => {
  const len = Math.hypot(vx, vy);
  if (len <= max) return { x: vx, y: vy };
  const s = max / len;
  return { x: vx * s, y: vy * s };
};

const steerBodyToward = (body: Matter.Body, x: number, y: number) => {
  const vx = x - body.position.x;
  const vy = y - body.position.y;
  const velocity: Matter.Vector = capVector(vx, vy, SPEED_CAP);
  Body.setVelocity(body, velocity);
};

const clampBodyPosition = (
  body: Matter.Body,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
) => {
  const x = Math.max(minX, Math.min(maxX, body.position.x));
  const y = Math.max(minY, Math.min(maxY, body.position.y));
  if (x !== body.position.x || y !== body.position.y)
    Body.setPosition(body, { x, y });
};
