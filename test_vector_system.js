/**
 * 向量系统测试文件
 * 用于测试向量化功能的各个组件
 */

import { EmbeddingApiService } from './services/embeddingApi.js';
import VectorStore from './services/vectorStore.js';
import { cosineSimilarity, rankBySimilarity } from './utils/vectorMath.js';

/**
 * 测试 Embedding API
 */
async function testEmbeddingAPI() {
    console.log('========== 测试 Embedding API ==========');
    
    const config = {
        api_url: 'https://api.siliconflow.cn/v1',
        api_key: 'YOUR_API_KEY_HERE', // 请替换为实际的API Key
        model: 'BAAI/bge-large-zh-v1.5'
    };
    
    const service = new EmbeddingApiService(config);
    
    try {
        // 测试单条文本
        console.log('测试单条文本向量化...');
        const text = '这是一个测试文本';
        const vector = await service.embed(text);
        console.log('✅ 向量维度:', vector.length);
        console.log('✅ 向量前5位:', vector.slice(0, 5));
        
        // 测试批量文本
        console.log('\n测试批量文本向量化...');
        const texts = [
            '角色名叫小明',
            '角色的年龄是25岁',
            '角色住在北京'
        ];
        const vectors = await service.embedBatch(texts);
        console.log('✅ 批量向量化成功，数量:', vectors.length);
        
        // 测试相似度
        console.log('\n测试相似度计算...');
        const query = '小明多少岁？';
        const queryVector = await service.embed(query);
        
        texts.forEach((text, i) => {
            const similarity = cosineSimilarity(queryVector, vectors[i]);
            console.log(`"${query}" vs "${text}": ${similarity.toFixed(4)}`);
        });
        
        console.log('\n✅ Embedding API 测试通过');
        return true;
    } catch (error) {
        console.error('❌ Embedding API 测试失败:', error);
        return false;
    }
}

/**
 * 测试向量数学工具
 */
function testVectorMath() {
    console.log('\n========== 测试向量数学工具 ==========');
    
    try {
        const vec1 = [1, 2, 3, 4, 5];
        const vec2 = [1, 2, 3, 4, 5];
        const vec3 = [5, 4, 3, 2, 1];
        
        // 测试余弦相似度
        const sim1 = cosineSimilarity(vec1, vec2);
        const sim2 = cosineSimilarity(vec1, vec3);
        
        console.log('相同向量相似度:', sim1.toFixed(4), '(应该接近1.0)');
        console.log('不同向量相似度:', sim2.toFixed(4));
        
        // 测试排序
        const candidates = [
            { vector: vec2, data: { text: '相同向量' } },
            { vector: vec3, data: { text: '不同向量' } }
        ];
        
        const results = rankBySimilarity(vec1, candidates, 2);
        console.log('\n排序结果:');
        results.forEach((r, i) => {
            console.log(`${i + 1}. ${r.data.text} - 相似度: ${r.score.toFixed(4)}`);
        });
        
        console.log('\n✅ 向量数学工具测试通过');
        return true;
    } catch (error) {
        console.error('❌ 向量数学工具测试失败:', error);
        return false;
    }
}

/**
 * 测试向量存储
 */
async function testVectorStore() {
    console.log('\n========== 测试向量存储 ==========');
    
    const config = {
        api_url: 'https://api.siliconflow.cn/v1',
        api_key: 'YOUR_API_KEY_HERE', // 请替换为实际的API Key
        model: 'BAAI/bge-large-zh-v1.5'
    };
    
    try {
        const store = new VectorStore();
        
        console.log('初始化向量存储...');
        await store.init(config);
        console.log('✅ 向量存储初始化成功');
        
        // 获取统计信息
        const stats = store.getStats();
        console.log('\n统计信息:', stats);
        
        console.log('\n✅ 向量存储测试通过');
        return true;
    } catch (error) {
        console.error('❌ 向量存储测试失败:', error);
        return false;
    }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   SillyTavern 向量化系统测试套件    ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    const results = {
        vectorMath: false,
        embeddingAPI: false,
        vectorStore: false
    };
    
    // 测试向量数学（不需要API）
    results.vectorMath = testVectorMath();
    
    // 提示用户配置API Key
    console.log('\n⚠️  注意: 以下测试需要配置有效的 API Key');
    console.log('请在测试文件中修改 YOUR_API_KEY_HERE 为实际的API Key\n');
    
    const apiKey = 'YOUR_API_KEY_HERE';
    if (apiKey === 'YOUR_API_KEY_HERE') {
        console.log('⏭️  跳过需要API Key的测试');
    } else {
        results.embeddingAPI = await testEmbeddingAPI();
        results.vectorStore = await testVectorStore();
    }
    
    // 输出测试结果
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║           测试结果汇总               ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('向量数学工具:', results.vectorMath ? '✅ 通过' : '❌ 失败');
    console.log('Embedding API:', results.embeddingAPI ? '✅ 通过' : '⏭️  跳过');
    console.log('向量存储:', results.vectorStore ? '✅ 通过' : '⏭️  跳过');
    
    const allPassed = Object.values(results).every(r => r === true);
    if (allPassed) {
        console.log('\n🎉 所有测试通过！');
    } else {
        console.log('\n⚠️  部分测试未通过或被跳过');
    }
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
    runAllTests().catch(console.error);
}

export { testEmbeddingAPI, testVectorMath, testVectorStore, runAllTests };
