This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## gRPC (Connect-Web) client

This project uses `@connectrpc/connect-web` for gRPC/Protobuf in the browser.

### Configure endpoint

Set your backend base URL:

```bash
export NEXT_PUBLIC_GRPC_BASE_URL=https://api.example.com
```

### Create a client

Generate your service stubs (e.g., with `buf`), then create a client:

```ts
import { createTransport } from "@/lib/grpc/transport";
import { createGrpcClient } from "@/lib/grpc/client";
// After generating stubs with Buf + connect-web:
// import { AudioModelService } from "@/gen/org/example/voicingbackend/audiomodel/audiomodel_connect";

const transport = createTransport();
// const client = createGrpcClient(AudioModelService, transport);
### Generate stubs with Buf

Install Buf and the Connect-Web plugin, then add `buf.yaml` (already present) and run:

```bash
buf dep update
buf generate
```

Configure `buf.gen.yaml` like:

```yaml
version: v2
plugins:
  - remote: buf.build/connectrpc/es
    out: src/gen
    opt: target=ts
```

### Envoy proxy for local/dev

This repo includes an Envoy config to translate browser requests to your gRPC server (on 9090) into gRPC over HTTP/2.

Run Envoy via Docker:

```bash
docker compose up -d envoy
```

Set the frontend to use Envoy as the base URL:

```bash
export NEXT_PUBLIC_GRPC_BASE_URL=http://localhost:8081
```

Ensure your backend gRPC server is reachable at `127.0.0.1:9090`. On Docker Desktop, Envoy uses `host.docker.internal` to reach the host.

```

To add auth headers, use an interceptor in the transport creator (`src/lib/grpc/interceptors.ts`).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
