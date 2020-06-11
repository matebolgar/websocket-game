const express = require("express");
const socket = require("socket.io");
const Matter = require("matter-js");

const app = express();
const server = app.listen(4000);

app.use(express.static("public"));

const io = socket(server);

const Engine = Matter.Engine,
  World = Matter.World,
  Bodies = Matter.Bodies,
  Events = Matter.Events,
  Composites = Matter.Composites,
  Constraint = Matter.Constraint;

const engine = Engine.create();
const world = engine.world;
engine.world.gravity.y = 0;

const heavy = {
  frictionStatic: 3,
  friction: 2,
  stiffness: 0.2,
  restitution: 0.7,
  density: 0.2,
  frictionAir: 0.001,
};

const light = {
  frictionStatic: 1,
  friction: 1,
  stiffness: 0.2,
  restitution: 0.7,
  density: 0.01,
};

const fixed = {
  friction: 3,
  density: 1,
  stiffness: 1,
  restitution: 0,
  frictionStatic: 1,
  isStatic: true,
};

const rectangle = (options) => (x, y, w, h) =>
  Bodies.rectangle(x, y, w, h, {
    ...options,
    name: "Négyzet",
    width: w,
    height: h,
  });

const circle = (options) => (x, y, r) =>
  Bodies.circle(x, y, r, { ...options, name: "Kör", radius: r });

const rectangleHeavy = rectangle(heavy);
const rectangleLight = rectangle(light);
const rectangleFixed = rectangle(fixed);
const circleHeavy = circle(heavy);
const circleLight = circle(light);
const circleFixed = circle(fixed);

World.add(world, [
  rectangleFixed(500, 800, 1500, 500),
  rectangleFixed(-200, 330, 500, 500),
  rectangleFixed(1000, 330, 500, 500),
  rectangleFixed(100, -150, 1500, 500),
  // circleFixed(95, 125, 20),
  // circleFixed(95, 525, 20),
  // circleFixed(705, 125, 20),
  // circleFixed(705, 525, 20),
  Bodies.polygon(200, 460, 3, 60, { name: "Poligon" }),
  Bodies.polygon(400, 460, 5, 60, { name: "Poligon" }),
  rectangleLight(310, 129, 30, 30),
  rectangleHeavy(350, 129, 40, 40),
  // rectangleFixed(360, 129, 250, 20),
  rectangleHeavy(350, 129, 100, 100),
  circleLight(345, 129, 30),
  circleHeavy(345, 129, 20),
  car(345, 129, 150, 30, 30),
]);

function car(xx, yy, width, height, wheelSize) {
  const ret = Composites.car(xx, yy, width, height, wheelSize);
  ret.bodies.forEach((body) => {
    if (body.label === "Rectangle Body") {
      body.name = "Kocsi";
      body.width = width;
      body.height = height;
      return;
    }

    if (body.label === "Circle Body") {
      body.radius = wheelSize;
    }
  });
  return ret;
}

let i = 1;
const players = {};
io.use(function (socket, next) {
  socket.on("mouseDoubleClicked", function (data) {
    World.add(world, rectangleHeavy(data.x, data.y, 40, 40));
  });

  const mouse = Bodies.circle(10, 10, 1, {
    isStatic: true,
    name: "Játékos " + i,
    inertia: Infinity,
  });
  i++;
  World.add(world, mouse);

  const mouse2 = Bodies.circle(10, 10, 5, {
    name: "",
    inertia: Infinity,
    density: 0.5,
    stiffness: 10,
  });
  World.add(world, mouse2);

  const constraint = Constraint.create({
    bodyA: mouse,
    bodyB: mouse2,
    length: 5,
    stiffness: 0.08,
  });
  World.add(world, constraint);
  players[socket.id] = [mouse, mouse2, constraint];

  socket.on("mouseMoved", function (data) {
    mouse.position.x = data.x;
    mouse.position.y = data.y;
  });

  socket.on("mouseReleased", function (data) {
    const i = world.constraints.findIndex((cons) => cons.name === "pick");
    if (i !== -1) {
      world.constraints.splice(i, 1);
    }
  });

  const findPicked = (data) => {
    const fn = (body) =>
      body.position.x - 50 < data.x &&
      data.x < body.position.x + 50 &&
      body.position.y - 50 < data.y &&
      data.y < body.position.y + 50;

    const picked = world.bodies
      .filter((body) => body.name !== "mouse")
      .find(fn);
    if (picked) {
      return picked;
    }
    return flatten(world.composites.map((comp) => flatten(comp.bodies)))
      .filter((body) => body.name !== "mouse")
      .find(fn);
  };

  let constraintBodyB;

  socket.on("mouseClicked", function (pos) {
    const picked = findPicked(pos);
    if (!picked) {
      return;
    }

    if (pos.isBind) {
      if (constraintBodyB) {
        const a = picked.bounds.max.x - picked.bounds.min.x;
        const b = constraintBodyB.bounds.max.x - constraintBodyB.bounds.min.x;
        World.add(
          world,
          Constraint.create({
            bodyA: picked,
            bodyB: constraintBodyB,
            length: a / 2 + b / 2,
            stiffness: 0.002,
          })
        );
        constraintBodyB = null;
        return;
      } else {
        constraintBodyB = picked;
        return;
      }
    }

    const a = picked.bounds.max.x - picked.bounds.min.x;
    World.add(
      world,
      Constraint.create({
        name: "pick",
        bodyA: picked,
        bodyB: mouse2,
        length: a / 2 + 10,
        stiffness: 1,
      })
    );
  });

  Events.on(engine, "collisionStart", (collision) => {
    collision.pairs.forEach((pair) => {
      // pair.bodyA.isColliding = true;
      // pair.bodyB.isColliding = true;
      setTimeout(() => {
        pair.bodyA.isColliding = false;
        pair.bodyB.isColliding = false;
      }, 200);
      if (pair.bodyA.name && pair.bodyB.name) {
        console.log(`${pair.bodyA.name} ütközött ${pair.bodyB.name} testtel.`);
      }
    });
  });

  socket.on("disconnect", () => {
    players[socket.id].forEach((body) => {
      World.remove(world, body);
    });
    console.log(`Socket ${socket.id} disconnected.`);
  });

  if (socket.handshake.query.id) {
    return next();
  }
  next(new Error("Authentication error"));
});

const flatten = (arrays) => arrays.reduce((a, b) => a.concat(b), []);

const objectValue = ([x, ...xs], acc, def) =>
  xs.length === 0
    ? acc[x] === undefined
      ? def
      : acc[x]
    : acc[x] === undefined
    ? def
    : objectValue(xs, acc[x], def);

const toOut = (body) => ({
  parts: body.parts.map((part) => ({
    render: {
      visible: part.render.visible,
    },
    circleRadius: part.circleRadius,
    mass: part.mass,
    position: part.position,
    angle: part.angle,
    vertices: part.vertices.map((vertice) => ({
      x: vertice.x,
      y: vertice.y,
      internal: vertice.internal,
    })),
    isStatic: part.isStatic,
  })),
  render: {
    visible: objectValue(["render", "visible"], body, true),
  },
  position: body.position,
  width: body.width,
  height: body.height,
  radius: body.radius,
  angle: body.angle,
  label: body.label,
  mass: body.mass,
  name: body.name,
  isColliding: body.isColliding,
});

const toConstraint = (cons) => ({
  bodyA: cons.bodyA.position,
  bodyB: cons.bodyB.position,
  render: {
    visible: cons.render.visible,
  },
  length: cons.length,
  pointA: cons.pointA,
  pointB: cons.pointB,
});

setInterval(() => {
  Engine.update(engine);
  io.emit("sync", {
    bodies: [
      ...world.bodies.map(toOut),
      ...flatten(world.composites
          .map((comp) => comp.bodies.map(toOut))
      ),
    ],
    constraints: [...world.constraints.map(toConstraint)],
  });
}, 1000 / 30);

io.on("connection", (socket) => {
  console.log("made socket connection", socket.id);
});
