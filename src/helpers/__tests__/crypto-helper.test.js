import { decrypt, encrypt } from "../crypto-helper";

describe("crypto-helper", () => {
    describe("encrypt", () => {
        it("should encrypt a simple string", () => {
            // Arrange
            const data = "Hello World";

            // Act
            const result = encrypt(data);

            // Assert
            expect(result).toHaveProperty("iv");
            expect(result).toHaveProperty("content");
            expect(result.iv).toBeDefined();
            expect(result.content).toBeDefined();
            expect(typeof result.iv).toBe("string");
            expect(typeof result.content).toBe("string");
        });

        it("should produce different encrypted content for the same input", () => {
            // Arrange
            const data = "Test Data";

            // Act
            const result1 = encrypt(data);
            const result2 = encrypt(data);

            // Assert
            expect(result1.iv).not.toBe(result2.iv);
            expect(result1.content).not.toBe(result2.content);
        });

        it("should encrypt empty string", () => {
            // Arrange
            const data = "";

            // Act
            const result = encrypt(data);

            // Assert
            expect(result).toHaveProperty("iv");
            expect(result).toHaveProperty("content");
            expect(result.iv).toBeDefined();
            expect(result.content).toBeDefined();
        });

        it("should encrypt string with special characters", () => {
            // Arrange
            const data = "!@#$%^&*()_+-=[]{}|;':\",./<>?";

            // Act
            const result = encrypt(data);

            // Assert
            expect(result).toHaveProperty("iv");
            expect(result).toHaveProperty("content");
            expect(result.iv).toBeDefined();
            expect(result.content).toBeDefined();
        });

        it("should encrypt unicode characters", () => {
            // Arrange
            const data = "Hello 世界 🌍";

            // Act
            const result = encrypt(data);

            // Assert
            expect(result).toHaveProperty("iv");
            expect(result).toHaveProperty("content");
            expect(result.iv).toBeDefined();
            expect(result.content).toBeDefined();
        });

        it("should encrypt JSON string", () => {
            // Arrange
            const jsonData = JSON.stringify({ name: "John", age: 30, city: "New York" });

            // Act
            const result = encrypt(jsonData);

            // Assert
            expect(result).toHaveProperty("iv");
            expect(result).toHaveProperty("content");
            expect(result.iv).toBeDefined();
            expect(result.content).toBeDefined();
        });

        it("should encrypt long string", () => {
            // Arrange
            const data = "A".repeat(1000);

            // Act
            const result = encrypt(data);

            // Assert
            expect(result).toHaveProperty("iv");
            expect(result).toHaveProperty("content");
            expect(result.iv).toBeDefined();
            expect(result.content).toBeDefined();
        });
    });

    describe("decrypt", () => {
        it("should decrypt encrypted data correctly", () => {
            // Arrange
            const originalData = "Hello World";
            const encrypted = encrypt(originalData);

            // Act
            const result = decrypt(encrypted);

            // Assert
            expect(result).toBe(originalData);
        });

        it("should decrypt empty string", () => {
            // Arrange
            const originalData = "";
            const encrypted = encrypt(originalData);

            // Act
            const result = decrypt(encrypted);

            // Assert
            expect(result).toBe(originalData);
        });

        it("should decrypt string with special characters", () => {
            // Arrange
            const originalData = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
            const encrypted = encrypt(originalData);

            // Act
            const result = decrypt(encrypted);

            // Assert
            expect(result).toBe(originalData);
        });

        it("should decrypt unicode characters", () => {
            // Arrange
            const originalData = "Hello 世界 🌍";
            const encrypted = encrypt(originalData);

            // Act
            const result = decrypt(encrypted);

            // Assert
            expect(result).toBe(originalData);
        });

        it("should decrypt JSON string", () => {
            // Arrange
            const originalData = JSON.stringify({ name: "John", age: 30, city: "New York" });
            const encrypted = encrypt(originalData);

            // Act
            const result = decrypt(encrypted);

            // Assert
            expect(result).toBe(originalData);
        });

        it("should decrypt long string", () => {
            // Arrange
            const originalData = "A".repeat(1000);
            const encrypted = encrypt(originalData);

            // Act
            const result = decrypt(encrypted);

            // Assert
            expect(result).toBe(originalData);
        });
    });

    describe("encrypt/decrypt roundtrip", () => {
        it.each([
            ["Simple text", "Hello World"],
            ["Empty string", ""],
            ["Special characters", "!@#$%^&*()_+-=[]{}|;':\",./<>?"],
            ["Unicode characters", "Hello 世界 🌍"],
            ["JSON data", JSON.stringify({ name: "John", age: 30, city: "New York" })],
            ["Long string", "A".repeat(1000)],
            ["Numbers as string", "123456789"],
            ["Mixed content", "Hello 123 !@# 世界"],
        ])("should successfully encrypt and decrypt %s", (description, data) => {
            // Act
            const encrypted = encrypt(data);
            const decrypted = decrypt(encrypted);

            // Assert
            expect(decrypted).toBe(data);
        });

        it("should handle multiple encrypt/decrypt cycles", () => {
            // Arrange
            const originalData = "Test Data";

            // Act
            const encrypted1 = encrypt(originalData);
            const decrypted1 = decrypt(encrypted1);
            const encrypted2 = encrypt(decrypted1);
            const decrypted2 = decrypt(encrypted2);

            // Assert
            expect(decrypted1).toBe(originalData);
            expect(decrypted2).toBe(originalData);
        });
    });

    describe("error handling", () => {
        it("should handle invalid hash structure in decrypt", () => {
            // Arrange
            const invalidHash = { iv: "invalid", content: "invalid" };

            // Act & Assert
            expect(() => decrypt(invalidHash)).toThrow();
        });

        it("should handle missing properties in decrypt", () => {
            // Arrange
            const invalidHash = {};

            // Act & Assert
            expect(() => decrypt(invalidHash)).toThrow();
        });

        it("should handle null hash in decrypt", () => {
            // Act & Assert
            expect(() => decrypt(null)).toThrow();
        });

        it("should handle undefined hash in decrypt", () => {
            // Act & Assert
            expect(() => decrypt(undefined)).toThrow();
        });
    });

    describe("encryption properties", () => {
        it("should produce consistent iv length", () => {
            // Arrange
            const data = "Test Data";
            const results = [];

            // Act
            for (let i = 0; i < 10; i++) {
                results.push(encrypt(data));
            }

            // Assert
            results.forEach(result => {
                expect(result.iv).toHaveLength(32); // 16 bytes = 32 hex characters
            });
        });

        it("should produce consistent content format", () => {
            // Arrange
            const data = "Test Data";
            const result = encrypt(data);

            // Assert
            expect(result.iv).toMatch(/^[0-9a-f]+$/i);
            expect(result.content).toMatch(/^[0-9a-f]+$/i);
        });

        it("should produce different encrypted content for different inputs", () => {
            // Arrange
            const data1 = "Hello";
            const data2 = "World";

            // Act
            const result1 = encrypt(data1);
            const result2 = encrypt(data2);

            // Assert
            expect(result1.content).not.toBe(result2.content);
        });
    });
});
