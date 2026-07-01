# ✨ UbsBlast

[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/Framework-NestJS-red?logo=nestjs)](https://nestjs.com/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Container-Docker-2496ED?logo=docker)](https://www.docker.com/)
[![ESLint](https://img.shields.io/badge/Linter-ESLint-4B32C3?logo=eslint)](https://eslint.org/)
[![Prettier](https://img.shields.io/badge/Formatter-Prettier-F7B93E?logo=prettier)](https://prettier.io/)

> A self-hosted, open-source WhatsApp API Gateway, known as OpenWA, providing a comprehensive HTTP API for WhatsApp interactions alongside a modern web dashboard for session, webhook, and infrastructure management. It offers robust features like multi-session support, pluggable WhatsApp engines, and flexible deployment options.

## ✨ Key Features

*   **WhatsApp API Gateway:** Provides a powerful REST API for programmatic interaction with WhatsApp, enabling sending and receiving messages, managing contacts, groups, and more.
*   **Real-time WebSocket Events:** Utilizes Socket.IO for live updates on session status, incoming messages, and other critical events, facilitating dynamic application integration.
*   **Multi-Session Management:** Supports creating, monitoring, and controlling multiple WhatsApp sessions concurrently, ideal for multi-tenant or scaled deployments.
*   **Interactive Web Dashboard:** A modern, React-based frontend for intuitive management of WhatsApp sessions, configuration of webhooks, API keys, and monitoring of system infrastructure.
*   **Pluggable WhatsApp Engines:** Flexibility to choose between `whatsapp-web.js` (default) or `Baileys` as the underlying WhatsApp interaction engine, catering to different performance and feature needs.
*   **Secure API Key Authentication:** Manages access with API keys, supporting role-based access control and CIDR IP whitelisting for enhanced security.
*   **Comprehensive Webhook System:** Configurable webhooks with HMAC signatures, enabling external services to receive real-time notifications about WhatsApp events, complete with retry mechanisms.
*   **Flexible Data Storage:** Supports SQLite for lightweight, file-based storage and PostgreSQL for robust, scalable relational database needs, managed via TypeORM migrations.
*   **Containerized Deployment:** Optimized for Docker and Docker Compose, simplifying setup, deployment, and scaling of the API gateway and its associated services.
*   **Rate Limiting & Audit Logging:** Implements API rate limiting to prevent abuse and detailed audit logging for tracking system activities and ensuring compliance.
*   **Plugin Extension System:** An extensible architecture that allows for the integration of custom plugins to extend functionality and adapt to specific use cases.
*   **Multi-Language SDKs:** Provides officially supported client libraries for JavaScript/TypeScript, Python, and PHP, simplifying integration for developers across different language ecosystems.
*   **Internationalization (i18n):** The dashboard supports multiple languages, indicated by locale files for Arabic, English, Spanish, French, Hebrew, Italian, Brazilian Portuguese, Telugu, Simplified Chinese, and Traditional Chinese.

## 🛠️ Technology Stack

| Category           | Technology                           | Notes                                                               |
| :----------------- | :----------------------------------- | :------------------------------------------------------------------ |
| **Languages**      | TypeScript, PHP, Python              | Primary language for backend/frontend, SDKs for PHP & Python      |
| **Backend**        | Node.js, NestJS                      | Robust, scalable server-side framework                              |
| **Frontend**       | React, Vite, TanStack Query, Socket.IO Client | Modern UI development, fast build tool, state management, real-time |
| **WhatsApp Engines** | whatsapp-web.js, Baileys             | Pluggable engines for WhatsApp interaction                          |
| **Database/ORM**   | TypeORM, SQLite, PostgreSQL          | Object-Relational Mapper with support for multiple databases       |
| **Queue**          | BullMQ, Redis                        | For robust background jobs and message queuing                      |
| **Cloud/Storage**  | AWS S3 SDK (MinIO compatible)        | Object storage integration for media files                          |
| **Containerization** | Docker, Docker Compose               | For streamlined development, deployment, and orchestration        |
| **Testing**        | Jest                                 | Unit and integration testing framework                              |
| **Linting/Formatting** | ESLint, Prettier                     | Code quality and style enforcement                                  |

## 🏛️ Architecture Overview

The project follows a modular, API-first architecture designed for scalability and extensibility:

*   **Core API (NestJS):** A TypeScript-based backend API (OpenWA API Gateway) built with NestJS, serving as the central hub for all WhatsApp interactions. It exposes REST endpoints and WebSocket channels for real-time events.
*   **Integrated Dashboard (React/Vite):** A single-page application (SPA) dashboard developed with React and Vite, bundled and served directly by the NestJS API. It provides a user-friendly interface for managing the gateway.
*   **Pluggable WhatsApp Engines:** The core API can seamlessly switch between `whatsapp-web.js` (Chromium-based) and `Baileys` (WebSocket-based) engines, offering flexibility for different operational environments.
*   **Flexible Persistence Layer:** Utilizes TypeORM to abstract database interactions, supporting both embedded SQLite for simple deployments and external PostgreSQL for production-grade, scalable data storage.
*   **Object Storage Integration:** Supports local file storage and S3-compatible object storage (e.g., MinIO, AWS S3) for media files, configurable via environment variables.
*   **Containerized Deployment:** The entire application, including optional database and caching services (PostgreSQL, Redis, MinIO), is orchestrated using Docker Compose, ensuring consistent environments and ease of deployment.
*   **External SDKs:** Provides dedicated client libraries in JavaScript/TypeScript, Python, and PHP to facilitate integration with external applications.

## 🚀 Getting Started

To get started with UbsBlast (OpenWA), follow these steps.

### Prerequisites

*   Node.js (LTS recommended, version 20+)
*   npm (Node Package Manager)
*   Git
*   Docker and Docker Compose (for containerized setup)

### Local Development Setup (API + Dashboard)

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/Lannnnnzzzzzzzzzzz/UbsBlast.git
    cd UbsBlast
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```
    This command will also automatically install dependencies for the `dashboard/` sub-project.

3.  **Configure Environment:**
    ```bash
    cp .env.minimal .env
    # Optionally, edit .env to customize settings like API_PORT, DATABASE_TYPE, etc.
    ```

4.  **Create Data Directories:**
    ```bash
    mkdir -p data/sessions data/media
    ```

5.  **Start the Development Server:**
    ```bash
    npm run dev
    ```
    This command starts both the NestJS API (with hot-reload) and the Vite development server for the dashboard.

    *   **Dashboard:** `http://localhost:2886` (proxies API requests to `http://localhost:2785`)
    *   **API:** `http://localhost:2785/api`
    *   **Swagger Docs:** `http://localhost:2785/api/docs`
    *   **Health Check:** `http://localhost:2785/api/health`

### Docker Deployment (API + Dashboard with SQLite)

For a quick, production-like setup using Docker:

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/Lannnnnzzzzzzzzzzz/UbsBlast.git
    cd UbsBlast
    ```

2.  **Start Services:**
    ```bash
    docker compose up -d
    ```

    *   **Dashboard:** `http://localhost:2785`
    *   **API:** `http://localhost:2785/api`
    *   **Swagger Docs:** `http://localhost:2785/api/docs`

    *Note: This default setup uses SQLite for persistence. For PostgreSQL, Redis, or MinIO, use Docker Compose profiles (e.g., `docker compose --profile full up -d`). Refer to `docker-compose.yml` for detailed configuration options.*

### Obtaining an API Key

On first run, OpenWA generates a cryptographically random admin API key and writes it to `data/.api-key` (or `/app/data/.api-key` inside the API container when using Docker). This key is also printed in the startup logs. For local development, you can set `ALLOW_DEV_API_KEY=true` in your `.env` file to seed the well-known, insecure `dev-admin-key`.

ns.md
    └── 23-plugin-sandboxing.md
```
