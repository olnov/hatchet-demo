This is a test setup for running Hatchet Lite with PostgreSQL using Docker Compose.
The main idea is to test a workflow running against two separate APIs using Hatchet Lite and PostgreSQL.

## Prerequisites
- Docker
- Docker Compose

## Usage
1. Start the services:
   ```sh
   docker-compose up -d
   ```
2. Access Hatchet Lite at [http://localhost:8888](http://localhost:8888).

## Stopping the Services
To stop the services, run:
```sh
docker-compose down
```