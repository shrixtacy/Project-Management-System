# DesignFlow - Project Management System

A sleek, modern Project Management System tailored for design and operations workflows. Built with **React**, **TypeScript**, **Vite**, and **Tailwind CSS**.

## Features
- **Glassmorphic UI**: Premium dark mode theme with golden accents and glassy components.
- **Role-Based Access Control**:
  - **Admin**: Full oversight, project creation, users management, and stage-by-stage project reports.
  - **Designer**: Specialized workflow through 6 distinct creative stages (Site Survey, Theme Ideas, Furniture Layout, 2D, 3D Visualization, P2P).
  - **Operations**: Post-design physical execution dashboard for handling actionable execution tasks.
- **P2P Handoff Protocol**: Seamless transition of projects from the creative design phase to the physical operations team.
- **Data Architecture**: Currently backed safely within the browser's `localStorage` for rapid, backend-less testing and prototyping.

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Explore the pre-seeded users:
   - Admin: `admin@designco.com` (pw: admin123)
   - Designer: `sarah@designco.com` (pw: designer123)
   - Operations: `mike@designco.com` (pw: ops123)
