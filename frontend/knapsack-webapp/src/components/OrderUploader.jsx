import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import TruckTopView from "./TruckTopView"; // 👈 เพิ่ม component ที่เราสร้างไว้

const BOX_DIMENSIONS = {
  1: { width: 39, length: 59, color: "red" },
  2: { width: 29, length: 39, color: "blue" }
};

export default function OrderUploader() {
  const [longFormatData, setLongFormatData] = useState([]);

  const [resultBoxes, setResultBoxes] = useState([]);

  const [layoutedBoxes, setLayoutedBoxes] = useState([]);
  const [productMap, setProductMap] = useState({});

  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  const sortedGroupedData = [...longFormatData]
    .sort((a, b) => a.customer_id - b.customer_id)
    .reduce((acc, row, i, arr) => {
      const isFirstOfGroup = i === 0 || row.customer_id !== arr[i - 1].customer_id;
      if (isFirstOfGroup) acc.currentColor = acc.currentColor === "#f9f9f9" ? "#e0e0e0" : "#f9f9f9";
      acc.rows.push({ ...row, showCustomer: isFirstOfGroup, bgColor: acc.currentColor });
      return acc;
    }, { rows: [], currentColor: "#f9f9f9" }).rows;

  const totalPages = Math.ceil(sortedGroupedData.length / itemsPerPage);
  const paginatedData = sortedGroupedData.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  //console.log("🚀 OrderUploader mounted");

  useEffect(() => {
    // ✅ ดึงข้อมูลสินค้าจาก backend
    fetch("http://localhost:8000/products")
      .then((res) => res.json())
      .then((data) => {
        //console.log("📦 products fetched:", data);
        const map = {};
        data.forEach((p) => {
          if (p.id != null && p.product_name) {
            //console.log("🧩 row =", p);  // 🔍 ตรวจแต่ละแถว
            map[p.id] = p.product_name;
          }
        });
        //console.log("✅ productMap", map);
        setProductMap(map);
      })
      .catch((err) => {
        console.error("❌ fetch error", err);
      });
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data;

        const customerIds = rows[0].slice(1); // First row, skip column 0
        const longData = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const productId = parseInt(row[0]);

          for (let j = 1; j < row.length; j++) {
            const quantity = parseInt(row[j]);
            const customerId = parseInt(customerIds[j - 1]);
            if (!isNaN(quantity)) {
              longData.push({
                product_id: productId,
                customer_id: customerId,
                quantity,
                customer_order: j  // ✅ ลำดับลูกค้าในไฟล์
              });
            }
          }
        }

        setLongFormatData(longData);
      },
    });
  };

  const handleSubmit = async () => {
    if (!longFormatData || longFormatData.length === 0) {
      alert("No data to submit");
      return;
    }
  
    //console.log("Submitting:", longFormatData);
  
    const res = await fetch("http://localhost:8000/process-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(longFormatData),
    });
  
    const result = await res.json();
    setResultBoxes(result.packed_boxes || []);

    const layouted = placeBoxesOnTruck(result.packed_boxes || []);
    //console.log("📦 Layouted Stack", layouted);

    setLayoutedBoxes(layouted);

  };
  
  const groupBoxesByStack = (boxes) => {
    const grouped = {};
    for (const box of boxes) {
      const key = `${box.color} - Stack ${box.stack_level}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(box);
    }
    return grouped;
  };

  const renderTruckLayout = () => {
    // 1️⃣ Group กล่องตามตำแหน่งจริง
    const stackMap = {};
  
    for (const box of resultBoxes) {
      const key = `${box.x}-${box.y}-${box.length}-${box.width}-${box.color}`;
      if (!stackMap[key]) stackMap[key] = [];
      stackMap[key].push(box);
    }
  
    // 2️⃣ แบ่ง stack ย่อยให้ไม่เกิน 5 กล่อง
    const allStacks = [];
  
    Object.values(stackMap).forEach(stack => {
      const sorted = stack.sort((a, b) => a.stack_level - b.stack_level);
      for (let i = 0; i < sorted.length; i += 5) {
        allStacks.push(sorted.slice(i, i + 5));
      }
    });
  
    // 3️⃣ เรียงลำดับ stack จากท้าย → หน้า
    const sortedStacks = allStacks.sort(
      (a, b) => b[0].customer_order - a[0].customer_order
    );
  
    return (
      <div style={{ marginTop: "40px" }}>
        <h3><b>🚚 Truck Loading Layout (Rear → Front)</b></h3>
        <div style={{
          display: "flex",
          flexDirection: "row-reverse",
          overflowX: "auto",
          padding: "10px",
          border: "2px solid #333",
          backgroundColor: "#eee",
        }}>
          {sortedStacks.map((stack, idx) => {
            const base = stack[0];
            const bgColor = base.color.includes("Red") ? "crimson" : "royalblue";
            const textColor = "white";
  
            return (
              <div key={idx} style={{
                width: "180px",
                minHeight: "160px",
                margin: "6px",
                backgroundColor: bgColor,
                color: textColor,
                padding: "8px",
                borderRadius: "6px",
                flexShrink: 0,
              }}>
                <div><strong>Stack ({stack.length})</strong></div>
                {stack.map((box) => (
                  <div key={box.box_id} style={{ marginTop: "4px" }}>
                    <div>📦 Box #{box.box_id}</div>
                    <div>Cust: {box.customer_id}</div>
                    <div>Level: {box.stack_level}</div>
                    <div style={{ fontSize: "12px", marginTop: "4px" }}>
                      {box.items.map((item, i) => (
                        <div key={i}>
                          {item.product_name} × {item.quantity}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: "center", marginTop: "10px" }}>
          🚪 ← ประตูรถ (ส่งก่อน) &nbsp;&nbsp;|&nbsp;&nbsp; ในสุด (ส่งหลัง) →
        </div>
      </div>
    );
  };
  
  
  
  const placeBoxesOnTruck = (packedBoxes) => {
    const stacks = []; // <-- return นี้ตรงเข้า TruckTopView
    const truckWidth = 200;
    let currentX = 0;
    let currentY = 0;
    const BOX_LIMIT_PER_STACK = 5;
  
    for (let box of packedBoxes) {
      const dim = BOX_DIMENSIONS[box.box_type_id] || {
        width: 40,
        length: 40,
        color: "gray",
      };
      let placed = false;
  
      for (let stack of stacks) {
        const base = stack[0];
        if (
          stack.length < BOX_LIMIT_PER_STACK &&
          base.color === dim.color &&
          base.x === currentX &&
          base.y === currentY &&
          base.width === dim.width &&
          base.length === dim.length
        ) {
          stack.push({
            box_id: box.box_id,
            x: base.x,
            y: base.y,
            width: dim.width,
            length: dim.length,
            stack_level: stack.length + 1,
            color: dim.color,
          });
          placed = true;
          break;
        }
      }
  
      if (!placed) {
        if (currentY + dim.width > truckWidth) {
          currentY = 0;
          currentX += dim.length;
        }
  
        stacks.push(
          {
            box_id: box.box_id,
            x: currentX,
            y: currentY,
            width: dim.width,
            length: dim.length,
            stack_level: 1,
            color: dim.color,
          },
        );
  
        currentY += dim.width;
      }
    }
  
    return stacks; // ✅ ไม่ต้อง flatten แล้ว!
  };
  
  

  return (
    <div style={{ maxWidth: "800px", margin: "20px auto" }}>
      <h2>📦 Upload ไฟล์คำสั่งซื้อ (csv)</h2>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      <br />
      <br />
      {longFormatData.length > 0 && (
        <>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th>หมายเลขสาขา</th>
                <th>ชื่อผลิตภัณฑ์</th>
                <th>จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {[...longFormatData]
                .sort((a, b) => a.customer_id - b.customer_id)
                .slice(0, 50)
                .reduce((acc, row, i, arr) => {
                  const isFirstOfGroup = i === 0 || row.customer_id !== arr[i - 1].customer_id;
                  if (isFirstOfGroup) acc.currentColor = acc.currentColor === "#f9f9f9" ? "#e0e0e0" : "#f9f9f9";
                  acc.rows.push({ ...row, showCustomer: isFirstOfGroup, bgColor: acc.currentColor });
                  return acc;
                }, { rows: [], currentColor: "#f9f9f9" }).rows.map((row, i) => (
                  <tr key={i} style={{ backgroundColor: row.bgColor, color: "black" }}>
                    <td>{row.showCustomer ? row.customer_id : ""}</td>
                    <td>{productMap[String(row.product_id)] || `#${row.product_id}`} {row.product_name}</td>
                    <td>{row.quantity}</td>
                  </tr>
                ))}
            </tbody>

          </table>
          <p>Showing first 50 entries (grouped by customer, alt color)</p>
          <br />
          <button onClick={handleSubmit}>จัดเรียงกล่องสินค้า</button>
        </>
      )}


    {resultBoxes.length > 0 && (
      <div style={{ marginTop: "30px" }}>
        <h3><b>Packing Result (Grid by Stack)</b></h3>
        {Object.entries(groupBoxesByStack(resultBoxes)).map(([stackLabel, boxes], i) => (
          <div key={i} style={{ marginBottom: "40px" }}>
            <h4 style={{ marginBottom: "10px" }}>{stackLabel}</h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "12px",
                border: "1px solid #aaa",
                padding: "10px",
              }}
            >
              {boxes.map((box) => {
                const bgColor = box.color.includes("Red")
                  ? "red"
                  : box.color.includes("Blue")
                  ? "blue"
                  : "#f0f0f0"; // fallback

                const textColor = "white"; // เพื่อให้อ่านชัดบนพื้นแดงหรือน้ำเงิน

                return (
                  <div
                    key={box.box_id}
                    style={{
                      border: "1px solid #ccc",
                      padding: "8px",
                      borderRadius: "6px",
                      backgroundColor: bgColor,
                      color: textColor,
                    }}
                  >
                    <strong>Box #{box.box_id}</strong><br />
                    <small>Customer: {box.customer_id}</small><br />
                    <small>Weight: {box.total_weight} kg</small>
                    <ul style={{ paddingLeft: "18px", marginTop: "6px" }}>
                      {box.items.map((item, j) => (
                        <li key={j}>
                          {item.product_name} — {item.quantity} ชิ้น
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}


            </div>
          </div>
        ))}
        
        <TruckTopView boxes={layoutedBoxes} />
        {renderTruckLayout()}
      </div>
    )}



    </div>
  );
}
