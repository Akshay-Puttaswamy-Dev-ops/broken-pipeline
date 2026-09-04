# Broken DevOps Assignment — README

## Overview

All reported issues have been resolved. This document outlines the identified problems, root causes, remediation steps, assumptions, validation process, and recommendations for future improvements.

---

## Issues Found

1. `docker-compose.yml` builds from `./backend`, which does not exist. The application resides in `./app`.
2. `app/Dockerfile` uses `COPY src .`, but there is no `app/src/` directory. Both `server.js` and `package.json` are located at the root of `app/`.
3. `docker-compose.yml` sets `DATABASE_HOST=dbserver`, while the PostgreSQL service is named `db`.
4. `docker-compose.yml` sets `DATABASE_PORT=5433`, although PostgreSQL listens on port `5432`.
5. `depends_on` only ensures that the database container starts; it does not verify database readiness.
6. `nginx/nginx.conf` proxies requests to `http://application:3001`, while the actual service is `app` on port `3000`.
7. `kubernetes/deployment.yaml` starts `index.js`, which does not exist. The correct entry point is `server.js`.
8. The liveness probe checks `/live`, but the application does not expose this endpoint.
9. The `/health` endpoint in `app/server.js` was hardcoded to return HTTP 500.
10. No GitHub Actions workflow was configured in the repository.

---

## Root Cause Analysis

### Build Failure
The build failed because Docker Compose referenced a non-existent `./backend` directory, and the Dockerfile attempted to copy a `src` directory that was not present in the application source.

### Database Connectivity Failure
The application could not connect to PostgreSQL because the hostname was incorrectly configured as `dbserver` instead of the service name `db`. Additionally, the configured port was `5433` instead of PostgreSQL’s default port `5432`. Even after correcting these values, startup failures could still occur because container startup does not guarantee database readiness.

### Nginx 502 Error
Nginx was configured to proxy traffic to an invalid upstream service (`application`) on an incorrect port (`3001`), resulting in a 502 Bad Gateway response.

### Kubernetes CrashLoopBackOff
The deployment attempted to execute `index.js`, which does not exist, causing the container to terminate immediately. Additionally, the liveness probe targeted a non-existent endpoint, and the health endpoint itself always returned a failure response.

### GitHub Actions Failure
No workflow definitions existed in the repository, so GitHub Actions had no jobs available to execute.

---

## Remediation Steps

- Updated `docker-compose.yml` to use `./app` as the build context.
- Modified `app/Dockerfile` to use `COPY . .` and added a `.dockerignore` file to prevent local dependencies from being copied into the image.
- Corrected database configuration values (`DATABASE_HOST=db`, `DATABASE_PORT=5432`).
- Added a PostgreSQL health check using `pg_isready` and configured `depends_on` to wait for a healthy database state.
- Updated the Nginx upstream configuration to `http://app:3000`.
- Updated the Kubernetes deployment command to start `server.js`.
- Changed the liveness probe path from `/live` to `/health`.
- Updated the `/health` endpoint to return HTTP 200.
- Added `.github/workflows/ci.yml` to automate image builds, application startup validation, and smoke testing.
- Added `kubernetes/secret.example.yaml` as a template for the required Kubernetes Secret.

---

## Assumptions

- `./app` is the intended build context because it is the only application directory in the repository.
- `server.js` is the intended entry point because it matches both the Dockerfile configuration and the `package.json` start script.
- PostgreSQL uses the default port `5432`.
- Secret values are intentionally excluded from source control and must be supplied separately.
- No automated test suite exists; therefore, CI validation is limited to build verification and smoke testing.
- Kubernetes database integration was intentionally left unchanged because the repository does not contain any existing database deployment or configuration pattern.

---

## Recommendations

### Reliability
- Add a Kubernetes readiness probe to verify database connectivity before routing traffic to application pods.
- Replace the single `pg.Client` instance with a connection pool and retry mechanism.
- Run multiple application replicas to improve availability.
- Implement graceful shutdown handling (`SIGTERM`) during deployments.

### Security
- Move database credentials from source code into environment variables or a secrets management solution.
- Run containers as non-root users.
- Pin image versions instead of relying on floating tags.
- Use a centralized secrets management solution for production deployments.

### Deployment Process
- Extend the CI pipeline to build and push images to Amazon ECR and deploy automatically to Amazon EKS.
- Enforce branch protection and mandatory CI checks before merging changes.
- Define Kubernetes resource requests and limits.
- Integrate the deployment with a production-ready PostgreSQL architecture.

---

## Verification

### Docker Compose Validation

```bash
docker compose build && docker compose up -d
curl -i http://localhost/
```

**Expected Result:** HTTP 200 response returned through Nginx.

### Kubernetes Validation

```bash
docker build -t broken-app:latest ./app
minikube image load broken-app:latest
cp kubernetes/secret.example.yaml kubernetes/secret.yaml
kubectl apply -f kubernetes/secret.yaml
kubectl apply -f kubernetes/deployment.yaml
kubectl port-forward deploy/broken-app 3000:3000
curl -i http://localhost:3000/health
```

**Expected Result:** HTTP 200 response from the health endpoint, with pods remaining healthy and stable.

---

## Running GitHub Actions with a Local Minikube Cluster (Self-Hosted Runner)

If you want GitHub Actions to build, deploy, and validate the application against a local Minikube cluster, configure a self-hosted runner on the same machine that runs Minikube.

### 1. Register a Self-Hosted Runner

- Navigate to **GitHub → Settings → Actions → Runners → New self-hosted runner**.
- Select the appropriate operating system and copy the commands provided by GitHub.
- The configuration command will include a one-time registration token:

```bash
./config.sh --url https://github.com/<your-org>/broken-pipeline --token <TOKEN>
```

- Start the runner:

```bash
./run.sh
```

- To run it as a service:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

### 2. Verify Host Dependencies

Ensure the following tools are installed and functional on the runner host:

- Docker
- kubectl
- Minikube

Verify Minikube is running and that kubectl is pointed to the correct cluster:

```bash
minikube start
kubectl config current-context
```

### 3. Workflow Behavior

The workflow (`.github/workflows/ci.yaml`) is manually triggered using `workflow_dispatch` and performs the following steps:

1. Checks out the repository.
2. Builds the Docker image:
   ```bash
   docker build -t broken-app:local ./app
   ```
3. Loads the image into Minikube:
   ```bash
   minikube image load broken-app:local
   ```
4. Applies the Kubernetes Secret and Deployment manifests.
5. Waits for deployment rollout completion.
6. Creates a background port-forward and validates the `/health` endpoint.

### 4. Required Manifest Changes

Update `kubernetes/deployment.yaml`:

```yaml
image: broken-app:local
imagePullPolicy: Never
```

Ensure the Kubernetes Secret is applied before deploying the application.

### 5. Triggering and Troubleshooting

- Trigger the workflow from **GitHub → Actions → Local Minikube Deploy → Run Workflow**.
- If the job remains queued, verify that the self-hosted runner is online and assigned the expected labels.
- If pods fail with `CreateContainerConfigError`, ensure the required Secret has been created and applied.
- Port-forward logs are stored on the runner host and can be used for troubleshooting deployment validation issues.

This setup enables evaluators to execute the same build-and-deploy smoke test directly from GitHub while targeting a local Minikube environment.
