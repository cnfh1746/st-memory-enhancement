/**
 * 向量数学工具
 * 提供向量计算相关的数学函数
 */

/**
 * 计算两个向量的余弦相似度
 * @param {number[]} vecA - 向量A
 * @param {number[]} vecB - 向量B
 * @returns {number} 相似度分数 (0-1)
 */
export function cosineSimilarity(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
        throw new Error('输入必须是数组');
    }

    if (vecA.length !== vecB.length) {
        throw new Error('向量维度不匹配');
    }

    if (vecA.length === 0) {
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);

    if (denominator === 0) {
        return 0;
    }

    return dotProduct / denominator;
}

/**
 * 计算向量的欧氏距离
 * @param {number[]} vecA - 向量A
 * @param {number[]} vecB - 向量B
 * @returns {number} 欧氏距离
 */
export function euclideanDistance(vecA, vecB) {
    if (vecA.length !== vecB.length) {
        throw new Error('向量维度不匹配');
    }

    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
        const diff = vecA[i] - vecB[i];
        sum += diff * diff;
    }

    return Math.sqrt(sum);
}

/**
 * 向量归一化
 * @param {number[]} vec - 输入向量
 * @returns {number[]} 归一化后的向量
 */
export function normalize(vec) {
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    
    if (norm === 0) {
        return vec.map(() => 0);
    }

    return vec.map(val => val / norm);
}

/**
 * 批量计算相似度并排序
 * @param {number[]} queryVector - 查询向量
 * @param {Array<{vector: number[], data: any}>} candidates - 候选向量及其数据
 * @param {number} topK - 返回前K个结果
 * @returns {Array<{score: number, data: any}>} 排序后的结果
 */
export function rankBySimilarity(queryVector, candidates, topK = 10) {
    const scored = candidates.map(candidate => ({
        score: cosineSimilarity(queryVector, candidate.vector),
        ...candidate
    }));

    // 按相似度降序排序
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
}

/**
 * 计算向量的平均值
 * @param {number[][]} vectors - 向量数组
 * @returns {number[]} 平均向量
 */
export function averageVectors(vectors) {
    if (!vectors || vectors.length === 0) {
        return [];
    }

    const dim = vectors[0].length;
    const avg = new Array(dim).fill(0);

    for (const vec of vectors) {
        for (let i = 0; i < dim; i++) {
            avg[i] += vec[i];
        }
    }

    return avg.map(val => val / vectors.length);
}

/**
 * 向量量化（降低精度以减少存储空间）
 * @param {number[]} vector - 输入向量
 * @param {number} bits - 量化位数 (8, 16)
 * @returns {number[]} 量化后的向量
 */
export function quantizeVector(vector, bits = 16) {
    if (bits !== 8 && bits !== 16) {
        throw new Error('仅支持8位或16位量化');
    }

    const max = Math.max(...vector.map(Math.abs));
    const scale = (Math.pow(2, bits - 1) - 1) / max;

    return vector.map(val => Math.round(val * scale) / scale);
}

/**
 * 计算向量的稀疏度
 * @param {number[]} vector - 输入向量
 * @param {number} threshold - 阈值
 * @returns {number} 稀疏度 (0-1)
 */
export function calculateSparsity(vector, threshold = 0.01) {
    const zeroCount = vector.filter(val => Math.abs(val) < threshold).length;
    return zeroCount / vector.length;
}

export default {
    cosineSimilarity,
    euclideanDistance,
    normalize,
    rankBySimilarity,
    averageVectors,
    quantizeVector,
    calculateSparsity
};
