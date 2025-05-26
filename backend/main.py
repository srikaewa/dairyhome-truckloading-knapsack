from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Body
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Product, Box
from pydantic import BaseModel
from typing import List, Dict
from collections import defaultdict


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # เปลี่ยนตามที่ frontend ของคุณรันอยู่
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BOX_COLOR_MAP = {
    1: "Red",
    2: "Blue"
}

# Dependency สำหรับ session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/products")
def read_products(db: Session = Depends(get_db)):
    return db.query(Product).all()

def get_box_dimensions(db: Session):
    boxes = db.query(Box).all()
    return {box.id: {
        "name": box.name,
        "width": box.width_cm,
        "length": box.length_cm,
        "height": box.height_cm
    } for box in boxes}

@app.get("/boxes")
def read_boxes(db: Session = Depends(get_db)):
    return get_box_dimensions(db)

class OrderItem(BaseModel):
    product_id: int
    customer_id: int
    quantity: int
    customer_order: int  # ลำดับลูกค้าในคอลัมน์ CSV

# Utility: load product weight from DB
def get_product_weights(db: Session) -> Dict[int, float]:
    products = db.query(Product).all()
    return {p.id: p.weight_kg for p in products}

# Utility: load box name (color) by ID
def get_box_colors(db: Session) -> Dict[int, str]:
    boxes = db.query(Box).all()
    return {box.id: box.name for box in boxes}

# Step: ดึง product_id → product_name
def get_product_info(db: Session):
    products = db.query(Product).all()
    return {p.id: {"name": p.product_name, "weight": p.weight_kg} for p in products}

# เพิ่ม y_grid เข้าไปใน stack key เพื่อไม่ให้กล่องคนละแนวซ้อนกัน
def get_stack_key(box):
    if box["color"] == "red":
        y_grid = round(box["y"] / 39) * 39
    else:
        y_grid = round(box["y"] / 29) * 29
    return (box["x"], y_grid, box["width"], box["length"], box["color"])



@app.post("/process-orders")
def process_orders(order_items: List[OrderItem] = Body(...), db: Session = Depends(get_db) ):
    product_info = get_product_info(db)
    box_names = get_box_colors(db)

    # แยกคำสั่งซื้อตาม customer_id และบันทึกลำดับ
    orders_by_customer = defaultdict(list)
    customer_order_map = {}

    for item in order_items:
        orders_by_customer[item.customer_id].append(item)
        customer_order_map[item.customer_id] = item.customer_order

    # ✅ เรียงลูกค้าจาก “ส่งหลัง → ส่งก่อน” (ลูกค้าขวาสุดก่อน)
    sorted_customers = sorted(customer_order_map.items(), key=lambda x: x[1], reverse=True)

    packed_boxes = []
    box_id_counter = 1

    for customer_id, _ in sorted_customers:
        items = orders_by_customer[customer_id]
        current_box = []
        current_weight = 0
        boxes = []

        for item in items:
            info = product_info.get(item.product_id, {"weight": 0.0, "name": f"Product {item.product_id}"})
            total_weight = info["weight"] * item.quantity

            # ถ้าเกิน 20 กก. → ปิดกล่อง
            if current_weight + total_weight > 20 and current_box:
                box_type_id = 1 if box_id_counter % 2 == 1 else 2
                boxes.append({
                    "box_id": box_id_counter,
                    "customer_id": customer_id,
                    "box_type_id": box_type_id,
                    "color": box_names.get(box_type_id, "Unknown"),
                    "total_weight": round(current_weight, 2),
                    "items": current_box
                })
                box_id_counter += 1
                current_box = []
                current_weight = 0

            current_box.append({
                "product_id": item.product_id,
                "product_name": info["name"],
                "quantity": item.quantity,
                "weight_each": info["weight"]
            })
            current_weight += total_weight

        # กล่องสุดท้ายของลูกค้า
        if current_box:
            box_type_id = 1 if box_id_counter % 2 == 1 else 2
            boxes.append({
                "box_id": box_id_counter,
                "customer_id": customer_id,
                "box_type_id": box_type_id,
                "color": box_names.get(box_type_id, "Unknown"),
                "total_weight": round(current_weight, 2),
                "items": current_box
            })
            box_id_counter += 1

        packed_boxes.extend(boxes)

    # ✅ จัด stack level → กล่องไม่เกิน 5 ชั้น
    box_type_counts = defaultdict(int)
    for box in packed_boxes:
        box_type = box["box_type_id"]
        box_type_counts[box_type] += 1
        box["stack_level"] = (box_type_counts[box_type] - 1) // 5 + 1

    return {"packed_boxes": packed_boxes}