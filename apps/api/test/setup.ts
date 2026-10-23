import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });
// Os testes não devem esbarrar em rate limit; só os de limite o reativam.
process.env.RATE_LIMIT_DISABLED = "1";
