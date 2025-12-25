/**
 * 小迹星后端服务
 * 处理音频上传、语音识别、知识点分析、PPT生成、视频合成
 */
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { processTimeMarker, processMultipleMarkers } from './services/processor.js';
import { checkFFmpeg } from './services/videoSynth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(config.tempDir, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `audio-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/x-m4a'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|m4a)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('只支持音频文件（MP3, WAV, M4A）'));
    }
  }
});

// 处理任务存储（简单的内存存储，生产环境应使用数据库）
const tasks = new Map();

// ==================== API 路由 ====================

/**
 * 健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    ffmpeg: checkFFmpeg(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * 检查服务配置状态
 */
app.get('/api/config/status', (req, res) => {
  res.json({
    talApi: {
      configured: !!(config.talApi.appId && config.talApi.appKey),
      baseUrl: config.talApi.baseUrl,
    },
    volcengineAsr: {
      configured: !!(config.volcengineAsr.appId && config.volcengineAsr.token),
    },
    volcengineTts: {
      configured: !!(config.volcengineTts.appId && config.volcengineTts.token),
    },
    ffmpeg: checkFFmpeg(),
  });
});

/**
 * 上传音频文件并处理
 * POST /api/process
 * Body: multipart/form-data
 *   - audio: 音频文件
 *   - markers: JSON 字符串，时间标记数组，如 "[600, 1200, 1800]"
 */
app.post('/api/process', upload.single('audio'), async (req, res) => {
  const taskId = Date.now().toString(36) + Math.random().toString(36).substring(2);
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传音频文件' });
    }

    // 解析时间标记
    let markers = [];
    if (req.body.markers) {
      try {
        markers = JSON.parse(req.body.markers);
        if (!Array.isArray(markers)) {
          markers = [markers];
        }
      } catch {
        markers = [300]; // 默认5分钟处
      }
    } else {
      markers = [300]; // 默认5分钟处
    }

    console.log(`\n收到处理请求 ${taskId}`);
    console.log('音频文件:', req.file.path);
    console.log('时间标记:', markers);

    // 创建任务
    const task = {
      id: taskId,
      status: 'processing',
      progress: 0,
      message: '准备处理...',
      audioFile: req.file.path,
      markers,
      results: [],
      createdAt: new Date().toISOString(),
    };
    tasks.set(taskId, task);

    // 立即返回任务 ID
    res.json({
      taskId,
      status: 'processing',
      message: '任务已创建，正在处理中',
    });

    // 异步处理
    processAudioInBackground(taskId, req.file.path, markers);

  } catch (error) {
    console.error('处理请求失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 后台处理音频
 */
async function processAudioInBackground(taskId, audioFilePath, markers) {
  const task = tasks.get(taskId);
  if (!task) return;

  try {
    const results = await processMultipleMarkers(
      audioFilePath,
      markers,
      (progress, message) => {
        task.progress = progress;
        task.message = message;
      },
      (index, data) => {
        // 更新单个任务状态
        if (!task.results[index]) {
          task.results[index] = {};
        }
        Object.assign(task.results[index], data);
      }
    );

    task.status = 'completed';
    task.progress = 100;
    task.message = '处理完成';
    task.results = results;
    task.completedAt = new Date().toISOString();

    console.log(`任务 ${taskId} 处理完成`);
  } catch (error) {
    console.error(`任务 ${taskId} 处理失败:`, error);
    task.status = 'failed';
    task.error = error.message;
  }

  // 清理上传的临时文件
  try {
    if (fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
    }
  } catch (e) {
    console.warn('清理临时文件失败:', e);
  }
}

/**
 * 获取任务状态
 * GET /api/tasks/:taskId
 */
app.get('/api/tasks/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  res.json({
    id: task.id,
    status: task.status,
    progress: task.progress,
    message: task.message,
    results: task.results,
    error: task.error,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
  });
});

/**
 * 获取所有任务
 * GET /api/tasks
 */
app.get('/api/tasks', (req, res) => {
  const taskList = Array.from(tasks.values()).map(task => ({
    id: task.id,
    status: task.status,
    progress: task.progress,
    message: task.message,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
  }));

  res.json(taskList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

/**
 * 获取文件（图片、音频、视频）
 * GET /api/files/:taskId/:filename
 */
app.get('/api/files/:taskId/:filename', (req, res) => {
  const { taskId, filename } = req.params;
  const filePath = path.join(config.outputDir, taskId, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  // 设置适当的 Content-Type
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
  };

  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.sendFile(filePath);
});

/**
 * 同步处理（等待结果）
 * POST /api/process/sync
 * 适用于测试和小文件
 */
app.post('/api/process/sync', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传音频文件' });
    }

    // 解析时间标记
    let markerTime = 300; // 默认5分钟
    if (req.body.marker) {
      markerTime = parseInt(req.body.marker, 10);
    }

    console.log('同步处理请求');
    console.log('音频文件:', req.file.path);
    console.log('时间标记:', markerTime);

    const result = await processTimeMarker(
      req.file.path,
      markerTime,
      (progress, message) => {
        console.log(`进度: ${progress.toFixed(1)}% - ${message}`);
      },
      null
    );

    // 清理临时文件
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json(result);
  } catch (error) {
    console.error('同步处理失败:', error);
    
    // 清理临时文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * 删除任务
 * DELETE /api/tasks/:taskId
 */
app.delete('/api/tasks/:taskId', (req, res) => {
  const taskId = req.params.taskId;
  const task = tasks.get(taskId);
  
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  // 删除输出文件
  const outputDir = path.join(config.outputDir, taskId);
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  tasks.delete(taskId);
  res.json({ success: true });
});

// 静态文件服务（输出目录）
app.use('/output', express.static(config.outputDir));

// 错误处理
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件太大，最大支持 500MB' });
    }
    return res.status(400).json({ error: error.message });
  }
  
  res.status(500).json({ error: error.message || '服务器内部错误' });
});

// 启动服务器
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log('小迹星后端服务已启动');
  console.log(`${'='.repeat(60)}`);
  console.log(`地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`配置状态: http://localhost:${PORT}/api/config/status`);
  console.log(`\n环境检查:`);
  console.log(`  - TAL API: ${config.talApi.appId ? '已配置' : '未配置'}`);
  console.log(`  - 火山引擎 ASR: ${config.volcengineAsr.appId ? '已配置' : '未配置'}`);
  console.log(`  - 火山引擎 TTS: ${config.volcengineTts.appId ? '已配置' : '未配置'}`);
  console.log(`  - ffmpeg: ${checkFFmpeg() ? '已安装' : '未安装'}`);
  console.log(`${'='.repeat(60)}\n`);
});

