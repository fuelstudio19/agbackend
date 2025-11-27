# Frontend Integration Guide for Ad Backend API

## 1. Introduction

Welcome! This guide will help you connect a React frontend (using Vite, TypeScript, and Tailwind CSS) to our Ad Backend API. The backend handles interactions with various advertising platforms (like Facebook Ads) and provides data through a RESTful API.

Before you begin, it's helpful to familiarize yourself with the backend's overall architecture and capabilities. You can refer to the [Backend Guidelines](./backend-guidelines.md) for more details. The backend also provides API documentation via Swagger, which will be crucial for understanding available endpoints.

## 2. Prerequisites

Before you start, ensure you have the following installed and have a basic understanding of:

*   **Node.js and npm/yarn**: For managing your frontend project and dependencies. (Node.js v16+ recommended)
*   **Git**: For version control.
*   **React**: Core concepts (components, hooks, state, props).
*   **TypeScript**: Basic syntax and type annotations.
*   **Tailwind CSS**: Utility-first CSS framework.
*   **Vite**: Build tool and development server.
*   **REST APIs**: How to make requests (GET, POST, etc.) and handle responses.
*   A code editor (e.g., VS Code).

## 3. Setting Up the Backend Locally

To effectively develop the frontend, you'll need to run the backend API on your local machine.

1.  **Clone the Backend Repository**:
    If you haven't already, clone the backend repository to your local machine.
    ```bash
    # Replace <your-repo-url> with the actual backend repository URL
    git clone <your-repo-url>
    cd agbackend # Or the name of the backend project directory
    ```

2.  **Install Backend Dependencies**:
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set Up Environment Variables**:
    *   The backend uses a `.env` file for configuration.
    *   Find the `.env.example` file in the root of the backend project.
    *   Rename or copy it to `.env`.
    *   **Crucially, update the variables in `.env`**:
        *   `PORT`: This is the port the backend will run on (e.g., `3002`). Make a note of this, as you'll need it for your frontend configuration.
        *   `SUPABASE_URL` and `SUPABASE_ANON_KEY`: These are for authentication. You might get these from a senior developer or your project lead if you're not setting up your own Supabase instance.
        *   `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_ACCESS_TOKEN`: For Facebook API access. Again, these might be provided.
    *   **Important**: Ensure the `.env` file is correctly configured. The backend might not start or function correctly without it.

4.  **Run the Backend Development Server**:
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    If successful, you should see output in your terminal indicating the server is running, typically on `http://localhost:PORT` (where `PORT` is the value from your `.env` file, e.g., `http://localhost:3002`).

5.  **Access Swagger API Documentation**:
    Once the backend is running, you can usually access its Swagger documentation in your browser at `http://localhost:PORT/api-docs` (e.g., `http://localhost:3002/api-docs`). This documentation is invaluable for seeing all available API endpoints, their request/response formats, and testing them directly.

## 4. Frontend Project Setup (React + Vite + TypeScript + Tailwind)

If you're starting a new frontend project:

1.  **Create a Vite Project**:
    ```bash
    npm create vite@latest my-frontend-app -- --template react-ts
    cd my-frontend-app
    ```

2.  **Install Tailwind CSS**:
    Follow the official Tailwind CSS guide for Vite: [Install Tailwind CSS with Vite](https://tailwindcss.com/docs/guides/vite)
    This typically involves:
    ```bash
    npm install -D tailwindcss postcss autoprefixer
    npx tailwindcss init -p
    ```
    Then configure `tailwind.config.js` and `index.css`.

3.  **Install Axios (or your preferred HTTP client)**:
    Axios is a popular choice for making API requests.
    ```bash
    npm install axios
    # or
    yarn add axios
    ```

## 5. Connecting to the Backend API

### 5.1. Configuring the API Base URL

It's best practice to store your backend API's base URL in an environment variable in your frontend project.

1.  **Create a `.env` file** in the root of your frontend project (`my-frontend-app`).
2.  Add the backend API URL. Remember that Vite requires environment variables exposed to the client to be prefixed with `VITE_`.
    ```env
    # In your frontend project's .env file
    VITE_API_BASE_URL=http://localhost:3002/api/v1 
    ```
    *   Replace `3002` with the actual port your backend is running on.
    *   The `/api/v1` suffix is based on the backend's main router configuration in `src/index.ts`.

3.  **Accessing the Environment Variable**:
    In your TypeScript code (e.g., in an API service module):
    ```typescript
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    console.log('API Base URL:', API_BASE_URL); // For debugging
    ```

### 5.2. Making API Requests (Example with Axios)

Create a dedicated module or service for your API calls. For example, `src/services/api.ts`:

```typescript
// src/services/api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Function to get the JWT token (you'll implement this later)
const getAuthToken = (): string | null => {
  const session = localStorage.getItem('authSession');
  if (session) {
    const parsedSession = JSON.parse(session);
    return parsedSession?.access_token || null;
  }
  return null;
};

// Add a request interceptor to include the JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
```

**Example: Fetching Ad Accounts**

Assuming the backend has an endpoint `GET /api/ad-accounts`:

```typescript
// In a component or a dedicated service file (e.g., src/services/adAccountService.ts)
import apiClient from './api'; // Assuming api.ts is in the same directory or adjust path

interface AdAccount {
  id: string;
  name: string;
  // ... other properties based on backend response
}

export const getAdAccounts = async (): Promise<AdAccount[]> => {
  try {
    // Note: The actual backend response structure wraps data in a top-level object.
    // Example: { success: true, data: AdAccount[] } or just { items: AdAccount[] } based on Swagger.
    // Adjust the .get<TYPE> and data extraction accordingly.
    const response = await apiClient.get<{ items: AdAccount[] }>('/ad-accounts'); // Path based on Swagger relative to /api/v1
    return response.data.items; // Assuming response is { items: [...] }
    // If it's { success: true, data: [...] }, use: 
    // if (response.data.success) { return response.data.data; } else { throw new Error(...) }
  } catch (error) {
    console.error('Error fetching ad accounts:', error);
    if (axios.isAxiosError(error) && error.response) {
      // Backend error structure might be { message: "..." } or { error: { message: "..." } }
      throw new Error(error.response.data?.message || error.response.data?.error?.message || 'An unknown error occurred fetching ad accounts');
    }
    throw error;
  }
};

// Example usage in a React component:
// import React, { useEffect, useState } from 'react';
// import { getAdAccounts } from './services/adAccountService'; // Adjust path
//
// const AdAccountList: React.FC = () => {
//   const [accounts, setAccounts] = useState<AdAccount[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//
//   useEffect(() => {
//     const fetchAccounts = async () => {
//       try {
//         setLoading(true);
//         setError(null);
//         const data = await getAdAccounts();
//         setAccounts(data);
//       } catch (err: any) {
//         setError(err.message);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchAccounts();
//   }, []);
//
//   if (loading) return <p>Loading ad accounts...</p>;
//   if (error) return <p>Error: {error}</p>;
//
//   return (
//     <ul>
//       {accounts.map(account => <li key={account.id}>{account.name}</li>)}
//     </ul>
//   );
// };
```

### 5.3. Handling Authentication (JWT Flow)

Our backend uses JWT (JSON Web Tokens) for authentication.

1.  **Login Endpoint**:
    *   The login endpoint is `POST /auth/login` (full path: `http://localhost:PORT/api/v1/auth/login`).
    *   It expects `email` and `password` in the request body.
    *   On successful login, the backend returns a session object containing the JWT.

2.  **Storing the JWT & Session**:
    *   When the login is successful, store the relevant parts of the session object from the backend. The JWT itself is usually `session.access_token`.
    ```typescript
    // Example login function
    // interface SupabaseSession { // Define based on actual Supabase session structure
    //   access_token: string;
    //   refresh_token?: string;
    //   expires_in?: number;
    //   expires_at?: number;
    //   token_type?: string;
    //   user?: any; // Define a User interface for this
    // }
    // 
    // async function loginUser(credentials: LoginCredentials) {
    //   const response = await apiClient.post<{ message: string; session: SupabaseSession }>('/auth/login', credentials);
    //   const session = response.data.session;
    //   if (session && session.access_token) {
    //     localStorage.setItem('authSession', JSON.stringify(session)); // Store the whole session or just parts
    //     // For the interceptor, ensure getAuthToken() can retrieve the access_token from this stored item
    //   } else {
    //     throw new Error(response.data.message || 'Login failed to return a session or token');
    //   }
    //   return response.data;
    // }
    ```

3.  **Sending the JWT with Requests**:
    *   The `apiClient` setup earlier (with the request interceptor) automatically includes the `Authorization: Bearer <token>` header in all subsequent requests if a token is found in `localStorage`.

4.  **Logout**:
    *   To log out, simply remove the stored session from `localStorage`.
    ```typescript
    // function logoutUser() {
    //   localStorage.removeItem('authSession');
    //   // Clear user state, redirect to login page, etc.
    // }
    ```

5.  **Protected Routes & Getting User Profile**:
    *   Some backend routes will require authentication. If you try to access them without a valid JWT, the backend will likely return a `401 Unauthorized` or `403 Forbidden` error.
    *   Your frontend should handle these errors, perhaps by redirecting the user to the login page.
    *   The backend does not have a dedicated `/auth/me` route in `authRoutes.ts`. Check the Swagger documentation for an endpoint under user-related routes (e.g., `/users/profile` or similar) that might return the current authenticated user's details. This endpoint would require the JWT.

### 5.4. Key Backend Endpoints and Using Swagger

*   **Consult Swagger Regularly**: The Swagger documentation (`http://localhost:PORT/api-docs`) is your primary reference for:
    *   Available endpoints (e.g., `/ad-accounts`, `/campaigns`, `/ads/:id/insights`).
    *   HTTP methods for each endpoint (GET, POST, PUT, DELETE).
    *   Required request parameters (path params, query params, request body).
    *   Expected request and response structures/schemas (very detailed in `src/config/swagger.ts`).
*   **Authentication Endpoints**: Pay close attention to `/auth/login` and `/auth/register`. For fetching the authenticated user's profile, consult Swagger under user-related routes.

## 6. Data Handling and State Management

*   **Fetching Data**: Use `useEffect` for fetching data when components mount or when dependencies change.
*   **Displaying Data**: Map over arrays of data to render lists, display details in appropriate components.
*   **Loading States**: Always implement loading states (e.g., a spinner or "Loading..." message) while data is being fetched to provide user feedback.
*   **Error Handling**:
    *   Use `try...catch` blocks in your API service functions.
    *   The backend error responses generally include a `message` field. For validation errors, an `errors` array might also be present. The global error handler for 500 errors might return a plain string.
    *   Display user-friendly error messages in your components.
*   **State Management**:
    *   For simple local state, React's `useState` and `useReducer` hooks are sufficient.
    *   For more complex server state, caching, and synchronization, consider using a library like **TanStack Query (React Query)**. It greatly simplifies data fetching, caching, and optimistic updates.

    **Example with TanStack Query (Highly Recommended for server state)**:

    If you decide to use TanStack Query:
    ```bash
    npm install @tanstack/react-query
    # or
    yarn add @tanstack/react-query
    ```

    Setup in `main.tsx` or `App.tsx`:
    ```typescript
    // main.tsx or App.tsx
    import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
    // ... other imports

    const queryClient = new QueryClient();

    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </React.StrictMode>,
    );
    ```

    Usage in a component:
    ```typescript
    // In your component
    // import { useQuery } from '@tanstack/react-query';
    // import { getAdAccounts } from './services/adAccountService'; // Adjust path
    //
    // const AdAccountListWithReactQuery: React.FC = () => {
    //   const { data: accounts, error, isLoading, isError } = useQuery<AdAccount[], Error>({
    //     queryKey: ['adAccounts'], // Unique key for this query
    //     queryFn: getAdAccounts,   // The function that fetches the data
    //   });
    //
    //   if (isLoading) return <p>Loading ad accounts...</p>;
    //   if (isError) return <p>Error: {error.message}</p>;
    //
    //   return (
    //     <ul>
    //       {accounts?.map(account => <li key={account.id}>{account.name}</li>)}
    //     </ul>
    //   );
    // };
    ```

## 7. Important Considerations

*   **Environment Variables**:
    *   Never hardcode API keys, base URLs, or other sensitive information directly in your component code.
    *   Always use environment variables (`.env` file with `VITE_` prefix).
*   **CORS (Cross-Origin Resource Sharing)**:
    *   The backend (`src/index.ts`) does **not** currently have explicit CORS middleware enabled (e.g., `app.use(cors())`). This **must be added to the backend** to allow requests from your frontend's origin (e.g., `http://localhost:5173` if that's where your Vite dev server runs).
    *   If you encounter CORS errors in the browser console (e.g., "Access to XMLHttpRequest... blocked by CORS policy"), this is the reason. The backend team needs to implement and configure CORS.
*   **API Service Modules**:
    *   Organize your API calls into separate service modules (e.g., `adService.ts`, `authService.ts`). This keeps your components cleaner and makes API logic reusable and easier to manage.
*   **Type Safety**:
    *   Define TypeScript interfaces for your API request payloads and response data structures. The schemas defined in the backend's `src/config/swagger.ts` (e.g., `AdAccount`, `Campaign`, `Ad`, `User`, `AdInsight`) are excellent references for creating these interfaces.
    *   Example (referencing structures from `swagger.ts`):
        ```typescript
        // src/types/apiTypes.ts 
        // (You should create these based on the backend's Swagger component schemas)

        export interface User {
          id: string;
          email: string;
          name?: string; // Optional based on your User schema
          created_at?: string; 
        }

        export interface AdAccount {
          id: string; // e.g., act_12345
          account_id: string; // e.g., 12345
          name: string;
          currency?: string;
          account_status?: number;
          business_name?: string;
          // ... add other fields as defined in swagger.ts AdAccount schema
        }

        export interface Campaign {
          id: string;
          account_id: string;
          name: string;
          objective?: string;
          status?: string;
          // ... add other fields as defined in swagger.ts Campaign schema
        }

        // Interface for the login response session
        export interface AuthSession {
          access_token: string;
          token_type?: string;
          expires_in?: number;
          expires_at?: number;
          refresh_token?: string;
          user: User; // Embed the User interface
        }
        ```

## 8. Troubleshooting Tips

*   **Browser Developer Tools (Network Tab)**:
    *   This is your best friend for debugging API requests.
    *   Check the request URL, headers, payload, and method.
    *   Examine the response status code (e.g., 200, 401, 404, 500).
    *   Look at the response payload to see what data the backend sent back or if there's an error message.
*   **Backend Server Logs**:
    *   If an API request fails, check the logs of your locally running backend server. It might provide more detailed error messages or stack traces.
*   **CORS Errors**:
    *   Look for messages like "Access to XMLHttpRequest at '...' from origin '...' has been blocked by CORS policy." in the browser console. This means the backend needs to adjust its CORS configuration.
*   **Environment Variables Not Loading**:
    *   Ensure your `.env` file is in the root of your frontend project.
    *   Remember to prefix variables with `VITE_`.
    *   You might need to restart your Vite development server after adding or changing `.env` variables.
*   **Authentication Issues**:
    *   Double-check that the JWT is being stored correctly after login.
    *   Verify that the `Authorization: Bearer <token>` header is being sent with requests to protected routes (using the Network tab).
    *   Ensure the token hasn't expired (the backend usually handles token expiration).

Good luck, and don't hesitate to ask questions if you get stuck! 