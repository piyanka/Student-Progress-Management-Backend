# Student Progress Management Backend

## Environment setup

1. Copy `.env.example` to `.env`.
2. Set `MONGO_URI` to your MongoDB Atlas connection string.
3. Fill in the JWT and email variables if you use auth and reminder emails.

Example Atlas URI:

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/ed-tech?retryWrites=true&w=majority
```

## Free cloud MongoDB option

MongoDB Atlas offers a free shared cluster, which works well for this project.

1. Create a free Atlas account.
2. Create an `M0` free cluster.
3. Create a database user with username and password.
4. In Network Access, allow your current IP address.
5. Copy the connection string and replace the placeholders in `.env`.
6. Make sure the database name in the URI is `ed-tech` unless you want a different one.

## Run locally

```bash
npm install
npm start
```

The backend now reads `process.env.MONGO_URI` and falls back to local MongoDB only if that variable is not set.

## Health Check

Use `GET /health` to verify:

- server uptime
- MongoDB connection state
- active sync configuration
- the main API routes exposed by the backend
