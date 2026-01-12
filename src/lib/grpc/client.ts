import { createClient, type Client, type Transport } from "@connectrpc/connect";
import type { DescService } from "@bufbuild/protobuf";

// Import your generated service definitions here, e.g.:
// import { AudioService } from "@/gen/proto/audio/v1/audio_connect";

export const createGrpcClient = <TService extends DescService>(
  service: TService,
  transport: Transport,
) => createClient(service, transport) as Client<TService>;

export default createGrpcClient;


