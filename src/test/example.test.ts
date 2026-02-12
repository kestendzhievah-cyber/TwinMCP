describe('Example test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
