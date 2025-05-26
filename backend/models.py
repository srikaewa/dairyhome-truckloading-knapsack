from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Float

Base = declarative_base()

class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String)
    weight_kg = Column(Float)

# models.py
class Box(Base):
    __tablename__ = "boxes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    width_cm = Column(Integer)
    length_cm = Column(Integer)
    height_cm = Column(Integer)
