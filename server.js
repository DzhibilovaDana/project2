const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3001;

// Настройка CORS
app.use(cors());

// Добавляем логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Настройка хранилища для multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('Загрузка файла:', file.originalname);
    // Сохраняем файлы в текущую директорию
    cb(null, './');
  },
  filename: function (req, file, cb) {
    // Сохраняем оригинальное имя файла
    cb(null, file.originalname);
  }
});

// Фильтр файлов
const fileFilter = (req, file, cb) => {
  console.log('Проверка файла:', file.originalname);
  const isSof = file.originalname.toLowerCase().endsWith('.sof');
  console.log('Это .sof файл?', isSof);
  
  if (isSof) {
    cb(null, true);
  } else {
    cb(new Error('Поддерживаются только .sof файлы'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter
});

// Маршрут для загрузки файла
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    console.log('Получен запрос на загрузку');
    console.log('Файл в запросе:', req.file);
    
    if (!req.file) {
      console.log('Файл не найден в запросе');
      return res.status(400).json({ error: 'Файл не был загружен' });
    }
    
    console.log('Файл успешно загружен:', req.file.originalname);
    res.json({ 
      message: 'Файл успешно загружен',
      filename: req.file.originalname
    });
  } catch (error) {
    console.error('Ошибка при загрузке файла:', error);
    res.status(500).json({ error: 'Ошибка при загрузке файла: ' + error.message });
  }
});

// Добавляем обработку ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(500).json({ error: err.message });
});

app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
}); 