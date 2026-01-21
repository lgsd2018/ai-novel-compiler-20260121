import { SignJWT, jwtVerify } from "jose";

async function test() {
    const secret = "super_secret_jwt_key_for_dev_environment_12345";
    const secretKey = new TextEncoder().encode(secret);
    const payload = { openId: "test-user", appId: "test-app", name: "Test User" };

    try {
        const token = await new SignJWT(payload)
            .setProtectedHeader({ alg: "HS256", typ: "JWT" })
            .setExpirationTime("1h")
            .sign(secretKey);
        console.log("Signed token:", token);

        const verified = await jwtVerify(token, secretKey, {
            algorithms: ["HS256"],
        });
        console.log("Verified payload:", verified.payload);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
