import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig, loadEnv } from "vite";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), "");
    var apiTarget = env.VITE_API_BASE_URL || "https://egsnzyxipf.execute-api.us-east-1.amazonaws.com/prod";
    return {
        plugins: [react()],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "src"),
                "@pages": path.resolve(__dirname, "src/pages"),
                "@components": path.resolve(__dirname, "src/components"),
                "@modules": path.resolve(__dirname, "src/modules"),
                "@lib": path.resolve(__dirname, "src/lib"),
                "@api": path.resolve(__dirname, "src/api"),
            },
        },
        server: {
            host: true,
            port: 5173,
            proxy: {
                "/api": {
                    target: apiTarget,
                    changeOrigin: true,
                    rewrite: function (path) { return path.replace(/^\/api/, ""); },
                    headers: {
                        "x-api-key": env.VITE_API_KEY || ""
                    }
                }
            }
        }
    };
});
