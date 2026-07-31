using Vectors;

namespace Tests;

[TestFixture]
public class VectorGeneratorTests
{
    [Test]
    public void Generate_ContainsKnownPair_1403_10_22()
    {
        var vectors = VectorGenerator.Generate(1403, 1403);
        var v = vectors.Single(x => x is { Pm: 10, Pd: 22 });
        Assert.That((v.Gy, v.Gm, v.Gd), Is.EqualTo((2025, 1, 11)));
    }

    [Test]
    public void Generate_LeapYear1403_Has366Days()
    {
        Assert.That(VectorGenerator.Generate(1403, 1403), Has.Count.EqualTo(366));
    }
}
