# 🪵 CarpenterBI — Intelligent Workshop Management & Business Intelligence

**Craft Better. Manage Smarter.**

CarpenterBI is a full-stack workshop management and business intelligence platform designed to help woodworking businesses manage their daily operations through a centralized system.

It brings together employee management, inventory tracking, order management, task assignments, machine learning-based worker recommendations and business analytics.

The platform aims to help workshop owners improve operational visibility, organize resources and make data-informed business decisions.

---

## 🚀 Key Features

### 1. Employee Management
- Maintain employee records.
- Track employee experience and availability.
- View employee work history.
- Organize workforce information.

### 2. Inventory Management
- Maintain raw material records.
- Track available stock quantities.
- Configure reorder levels.
- Identify low-stock materials.
- Restock and update inventory.

### 3. Order Management
- Create and manage customer orders.
- Maintain order items and product details.
- Track order status and delivery dates.
- Monitor order progress.

### 4. AI-Based Worker Recommendations
- Recommend available employees for workshop tasks.
- Estimate task duration using a machine learning model.
- Use employee experience and historical work records in recommendations.
- Support better workforce allocation decisions.

### 5. Task Assignment
- Assign tasks to employees against orders.
- Set task descriptions and due dates.
- Track assignment status.
- Maintain assignment records.

### 6. Business Intelligence
- View workshop operational summaries.
- Monitor inventory indicators.
- Analyze business information through dashboard insights.

### 7. Material Demand Prediction
- Use historical material consumption data.
- Support material demand forecasting through a machine learning service.

---

## 🏗️ System Architecture

CarpenterBI follows a modular architecture with three major application services.

```text
                    CARPENTERBI PLATFORM
                            |
             +--------------+--------------+
             |              |              |
          Frontend       Backend        ML Service
             |              |              |
          Next.js         Express         FastAPI
             |              |              |
             |         PostgreSQL      ML Models
             |              |              |
             +--------------+--------------+
                            |
                    Business Operations
```

### Application Components

| Component | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js, React, TypeScript | User interface and dashboard |
| Backend | Node.js, Express.js | REST APIs and business logic |
| Database | PostgreSQL | Persistent business data |
| Database Management | pgAdmin 4 | Database administration |
| ML Service | Python, FastAPI | Machine learning predictions |
| ML Models | Python, scikit-learn | Worker duration and material demand prediction |

---

## 🛠️ Technology Stack

**Frontend**
- Next.js
- React
- TypeScript
- Tailwind CSS
- Lucide React

**Backend**
- Node.js
- Express.js
- PostgreSQL
- pg

**Machine Learning**
- Python
- FastAPI
- scikit-learn
- Pandas
- NumPy
- Joblib

**Development Tools**
- Visual Studio Code
- Git and GitHub
- pgAdmin 4
- Postman

---

## 📁 Project Structure

```text
CarpenterBI/
│
├── carpenter-dashboard/
│   ├── app/
│   │   ├── dashboard/
│   │   ├── employees/
│   │   ├── inventory/
│   │   ├── orders/
│   │   └── insights/
│   ├── components/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── employee-api/
│   ├── server.js
│   ├── db.js
│   ├── package.json
│   └── ...
│
├── ml-service/
│   ├── api.py
│   ├── prepare_data.py
│   ├── train_model.py
│   ├── worker_model.py
│   ├── worker_training_data.csv
│   └── ...
│
├── compose.yaml
├── compose.debug.yaml
├── .git
