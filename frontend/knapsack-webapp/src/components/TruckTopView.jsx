import React from "react";

const SCALE = 2;
const TRUCK_WIDTH_CM = 200;
const TRUCK_LENGTH_CM = 500;
const MAX_STACK_HEIGHT = 5;

const TruckTopView = ({ boxes }) => {
  if (!Array.isArray(boxes)) return <div>❌ No boxes</div>;

  // จัดกลุ่ม stack: สีเดียวกัน + ขนาดเดียวกัน
  const stackGroups = [];

  for (const box of boxes) {
    const key = `${box.length}-${box.width}-${box.color}`;
    let placed = false;

    for (const group of stackGroups) {
      const top = group[0];
      if (
        top.length === box.length &&
        top.width === box.width &&
        top.color === box.color &&
        group.length < MAX_STACK_HEIGHT
      ) {
        group.push(box);
        placed = true;
        break;
      }
    }

    if (!placed) {
      stackGroups.push([box]);
    }
  }

  // วาง stack บน layout
  const layout = [];
  let currentX = 0;
  let currentY = 0;

  for (const stack of stackGroups) {
    const base = stack[0];
    if (currentY + base.width > TRUCK_WIDTH_CM) {
      currentY = 0;
      currentX += base.length;
    }

    layout.push({
      x: currentX,
      y: currentY,
      width: base.width,
      length: base.length,
      color: base.color,
      boxes: stack,
    });

    currentY += base.width;
  }

  return (
    <div
      style={{
        position: "relative",
        width: TRUCK_LENGTH_CM * SCALE,
        height: TRUCK_WIDTH_CM * SCALE,
        border: "2px solid #000",
        backgroundColor: "#f8f8f8",
        margin: "20px auto",
      }}
    >
      {layout.map((stack, idx) => {
        const label = stack.boxes
          .sort((a, b) => a.box_id - b.box_id)
          .map((b) => `#${b.box_id}`)
          .join(" / ");

        const bgColor =
          stack.color === "red"
            ? "crimson"
            : stack.color === "blue"
            ? "royalblue"
            : "#999";

        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              left: stack.x * SCALE,
              top: stack.y * SCALE,
              width: stack.length * SCALE,
              height: stack.width * SCALE,
              backgroundColor: bgColor,
              color: "white",
              fontWeight: "bold",
              fontSize: 12,
              border: "1px solid #333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 4,
              boxSizing: "border-box",
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
};

export default TruckTopView;
