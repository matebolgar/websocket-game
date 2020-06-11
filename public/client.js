function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const storedId = localStorage.getItem("userId");
let id = storedId ? storedId : uuidv4();
localStorage.setItem("userId", id);

const socket = io.connect("http://localhost:4000", { query: "id=" + id });

let canvas;

function setup() {
  canvas = createCanvas(800, 800);
}

const massColor = (mass) => {
  if (!mass) {
    return '#333';
  }
  return mass > 50 ? "crimson" : "darkgreen";
};

function renderConstraints(constraints, context) {
  for (let constraint of constraints) {
    if (!constraint.pointA || !constraint.pointB) {
      continue;
    }

    const start = constraint.bodyA
      ? Vector.add(constraint.bodyA, constraint.pointA)
      : constraint.pointA;
    const end = constraint.bodyB
      ? Vector.add(constraint.bodyB, constraint.pointB)
      : constraint.pointB;

    context.beginPath();
    context.moveTo(start.x, start.y);

    const delta = Vector.sub(end, start),
      normal = Vector.perp(Vector.normalise(delta)),
      coils = Math.ceil(clamp(constraint.length / 5, 12, 20));

    let offset;
    for (let j = 1; j < coils; j += 1) {
      offset = j % 2 === 0 ? 1 : -1;
      context.lineTo(
        start.x + delta.x * (j / coils) + normal.x * offset * 4,
        start.y + delta.y * (j / coils) + normal.y * offset * 4
      );
    }

    context.lineTo(end.x, end.y);

    context.lineWidth = 1;
    context.strokeStyle = "white";
    context.stroke();

    context.fillStyle = "white";
    context.beginPath();
    context.arc(start.x, start.y, 3, 0, 2 * Math.PI);
    context.arc(end.x, end.y, 3, 0, 2 * Math.PI);
    context.closePath();
    context.fill();
  }
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function renderBodies(bodies) {
  for (let body of bodies) {
    if (!body.render.visible) {
      continue;
    }

    for (let k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
      let part = body.parts[k];

      if (!part.render.visible) {
        continue;
      }

      if (part.circleRadius) {
        push();
        translate(part.position.x, part.position.y);
        rotate(part.angle);
        rectMode(CENTER);
        strokeWeight(1);
        stroke("#333");
        fill(body.isColliding ? "yellow" : massColor(part.mass));
        ellipse(0, 0, part.circleRadius * 2);
        line(0, 0, part.circleRadius, 0);
        pop();
        continue;
      }

      beginShape();
      vertex(part.vertices[0].x, part.vertices[0].y);

      for (let j = 1; j < part.vertices.length; j++) {
        vertex(part.vertices[j].x, part.vertices[j].y);
      }
      vertex(part.vertices[0].x, part.vertices[0].y);
      rectMode(CENTER);
      strokeWeight(1);
      stroke("#333");
      fill(body.isColliding ? "yellow" : massColor(part.mass));
      endShape(CLOSE);
    }

    textSize(15);
    fill("white");
    stroke("black");
    textAlign(CENTER);
    text(body.name, body.position.x, body.position.y);
  }
}

function mouseDragged(e) {
  socket.emit("mouseMoved", {
    x: e.clientX,
    y: e.clientY,
  });
}

function mouseReleased() {
  socket.emit("mouseReleased", {});
}

function doubleClicked(e) {
  socket.emit("mouseDoubleClicked", {
    x: e.clientX,
    y: e.clientY,
    id: id,
  });
}

function mousePressed(e) {
  socket.emit("mouseClicked", {
    x: e.clientX,
    y: e.clientY,
    isBind: e.shiftKey,
  });
}

function mouseMoved(e) {
  socket.emit("mouseMoved", {
    x: e.clientX,
    y: e.clientY,
  });
}


let state = {
  bodies: [],
  constraints: [],
};

window.addEventListener("load", () => {
  // kliens oldali állapot felpopulálása, a szerverről érkezett adattal
  socket.on("sync", (data) => {
    state.bodies = data.bodies;
    state.constraints = data.constraints;
  });
});

// kliens oldali állapot kirajzolása, animation frame-enként
window.addEventListener("load", () => {
  requestAnimationFrame(function render() {
    background("#171717");
    renderBodies(state.bodies);
    renderConstraints(state.constraints, canvas.drawingContext);
    requestAnimationFrame(render);
  });
});



