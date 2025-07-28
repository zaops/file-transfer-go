// 文件传输相关功能

// 设置数据通道
function setupDataChannel(channel) {
    dataChannel = channel;
    let pendingChunkMeta = null;
    
    channel.onopen = () => {
        console.log('数据通道已打开');
        isP2PConnected = true;
        updateP2PStatus(true);
        
        // 清除连接超时定时器
        if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
        }
    };
    
    channel.onmessage = (event) => {
        // 检查是否是二进制数据
        if (event.data instanceof ArrayBuffer) {
            // 处理二进制数据块
            if (pendingChunkMeta && currentRole === 'receiver') {
                receiveFileChunk(pendingChunkMeta, event.data);
                pendingChunkMeta = null;
            }
        } else {
            // 处理JSON消息
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'file-chunk-meta') {
                    pendingChunkMeta = message;
                } else {
                    handleDataChannelMessage(event.data);
                }
            } catch (error) {
                console.error('解析数据通道消息失败:', error);
            }
        }
    };
    
    channel.onerror = (error) => {
        console.error('数据通道错误:', error);
        isP2PConnected = false;
        updateP2PStatus(false);
    };
    
    channel.onclose = () => {
        console.log('数据通道已关闭');
        isP2PConnected = false;
        updateP2PStatus(false);
    };
}

// 更新P2P连接状态
function updateP2PStatus(connected) {
    const receiverStatus = document.getElementById('receiverStatus');
    const downloadButtons = document.querySelectorAll('button[onclick^="downloadFile"]');
    
    if (currentRole === 'receiver' && receiverStatus) {
        if (connected) {
            receiverStatus.innerHTML = `
                <div class="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800">
                    <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    P2P连接已建立，可以下载文件
                </div>`;
            
            // 启用下载按钮
            downloadButtons.forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                btn.classList.add('hover:bg-blue-600');
            });
        } else {
            receiverStatus.innerHTML = `
                <div class="inline-flex items-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-800">
                    <span class="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                    正在建立P2P连接...
                </div>`;
            
            // 禁用下载按钮
            downloadButtons.forEach(btn => {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                btn.classList.remove('hover:bg-blue-600');
            });
        }
    }
}

// 下载文件
function downloadFile(fileId) {
    if (!isP2PConnected || !dataChannel || dataChannel.readyState !== 'open') {
        alert('P2P连接未建立，请等待连接建立后重试');
        return;
    }
    
    // 发送文件请求
    const request = {
        type: 'file-request',
        fileId: fileId
    };
    
    dataChannel.send(JSON.stringify(request));
    showTransferProgress(fileId, 'downloading');
}

// 处理数据通道消息
function handleDataChannelMessage(data) {
    try {
        const message = JSON.parse(data);
        
        switch (message.type) {
            case 'file-request':
                if (currentRole === 'sender') {
                    sendFileData(message.fileId);
                }
                break;
                
            case 'file-info':
                if (currentRole === 'receiver') {
                    // 存储文件信息用于下载
                    if (!fileTransfers.has(message.fileId)) {
                        fileTransfers.set(message.fileId, {
                            chunks: [],
                            totalSize: message.size,
                            receivedSize: 0,
                            fileName: message.name,
                            mimeType: message.mimeType
                        });
                    }
                }
                break;
                
            case 'file-data':
                // 旧的file-data类型已被file-chunk-meta + 二进制数据替代
                // 这里保留是为了向后兼容
                if (currentRole === 'receiver') {
                    receiveFileDataLegacy(message);
                }
                break;
                
            case 'file-complete':
                if (currentRole === 'receiver') {
                    completeFileDownload(message.fileId);
                }
                break;
        }
    } catch (error) {
        console.error('处理数据通道消息失败:', error);
    }
}

// 发送文件数据
function sendFileData(fileId) {
    const fileIndex = parseInt(fileId.split('_')[1]);
    const file = selectedFiles[fileIndex];
    
    if (!file) return;
    
    // 首先发送文件元信息
    const fileInfo = {
        type: 'file-info',
        fileId: fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        lastModified: file.lastModified
    };
    dataChannel.send(JSON.stringify(fileInfo));
    
    const reader = new FileReader();
    const chunkSize = 65536; // 增加到64KB chunks以提高速度
    let offset = 0;
    
    const sendChunk = () => {
        const slice = file.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
    };
    
    reader.onload = (e) => {
        const chunk = e.target.result;
        
        // 使用更高效的方式传输二进制数据
        if (dataChannel.readyState === 'open') {
            // 先发送元数据
            const metadata = {
                type: 'file-chunk-meta',
                fileId: fileId,
                offset: offset,
                size: chunk.byteLength,
                total: file.size,
                isLast: offset + chunk.byteLength >= file.size
            };
            dataChannel.send(JSON.stringify(metadata));
            
            // 再发送二进制数据
            dataChannel.send(chunk);
        }
        
        offset += chunk.byteLength;
        
        if (offset < file.size) {
            // 减少延迟以提高传输速度
            setTimeout(sendChunk, 1);
        } else {
            dataChannel.send(JSON.stringify({
                type: 'file-complete',
                fileId: fileId
            }));
        }
    };
    
    sendChunk();
}

// 接收文件块（二进制数据）
function receiveFileChunk(meta, chunkData) {
    if (!fileTransfers.has(meta.fileId)) {
        // 如果没有文件信息，创建默认的
        fileTransfers.set(meta.fileId, {
            chunks: [],
            totalSize: meta.total,
            receivedSize: 0,
            fileName: `unknown_file_${meta.fileId}`,
            mimeType: 'application/octet-stream'
        });
    }
    
    const transfer = fileTransfers.get(meta.fileId);
    transfer.chunks.push(new Uint8Array(chunkData));
    transfer.receivedSize += chunkData.byteLength;
    
    // 更新总大小（以防文件信息还没收到）
    if (transfer.totalSize !== meta.total) {
        transfer.totalSize = meta.total;
    }
    
    // 更新进度
    updateTransferProgress(meta.fileId, transfer.receivedSize, transfer.totalSize);
    
    if (meta.isLast) {
        completeFileDownload(meta.fileId);
    }
}

// 接收文件数据（向后兼容的旧版本）
function receiveFileDataLegacy(message) {
    if (!fileTransfers.has(message.fileId)) {
        // 如果没有文件信息，创建默认的
        fileTransfers.set(message.fileId, {
            chunks: [],
            totalSize: message.total,
            receivedSize: 0,
            fileName: `unknown_file_${message.fileId}`,
            mimeType: 'application/octet-stream'
        });
    }
    
    const transfer = fileTransfers.get(message.fileId);
    transfer.chunks.push(new Uint8Array(message.chunk));
    transfer.receivedSize += message.chunk.length;
    
    // 更新总大小（以防文件信息还没收到）
    if (transfer.totalSize !== message.total) {
        transfer.totalSize = message.total;
    }
    
    // 更新进度
    updateTransferProgress(message.fileId, transfer.receivedSize, transfer.totalSize);
    
    if (message.isLast) {
        completeFileDownload(message.fileId);
    }
}

// 完成文件下载
function completeFileDownload(fileId) {
    const transfer = fileTransfers.get(fileId);
    if (!transfer) return;
    
    // 合并所有chunks，使用正确的MIME类型
    const blob = new Blob(transfer.chunks, { type: transfer.mimeType });
    
    // 使用正确的文件名
    const fileName = transfer.fileName || `downloaded_file_${fileId}`;
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`文件下载完成: ${fileName}, 大小: ${formatFileSize(transfer.totalSize)}`);
    
    // 清理
    fileTransfers.delete(fileId);
    hideTransferProgress(fileId);
}

// 显示传输进度
function showTransferProgress(fileId, type) {
    const progressContainer = document.getElementById('transferProgress');
    const progressList = document.getElementById('progressList');
    
    progressContainer.classList.remove('hidden');
    
    // 获取文件名
    let fileName = fileId;
    if (currentRole === 'receiver') {
        // 从接收方文件列表中获取文件名
        const fileIndex = parseInt(fileId.split('_')[1]);
        const receiverFilesList = document.getElementById('receiverFilesList');
        const fileItems = receiverFilesList.querySelectorAll('.font-medium');
        if (fileItems[fileIndex]) {
            fileName = fileItems[fileIndex].textContent;
        }
    } else if (currentRole === 'sender') {
        // 从发送方文件列表中获取文件名
        const fileIndex = parseInt(fileId.split('_')[1]);
        if (selectedFiles[fileIndex]) {
            fileName = selectedFiles[fileIndex].name;
        }
    }
    
    const progressItem = document.createElement('div');
    progressItem.id = `progress_${fileId}`;
    progressItem.className = 'bg-gray-50 p-3 rounded-lg';
    progressItem.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="font-medium">${type === 'downloading' ? '📥 下载' : '📤 上传'}: ${fileName}</span>
            <span class="text-sm text-gray-500">0%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
    `;
    
    progressList.appendChild(progressItem);
}

// 更新传输进度
function updateTransferProgress(fileId, received, total) {
    const progressItem = document.getElementById(`progress_${fileId}`);
    if (!progressItem) return;
    
    const percentage = Math.round((received / total) * 100);
    const progressBar = progressItem.querySelector('.bg-blue-600');
    const percentageText = progressItem.querySelector('.text-gray-500');
    
    progressBar.style.width = percentage + '%';
    percentageText.textContent = percentage + '%';
}

// 隐藏传输进度
function hideTransferProgress(fileId) {
    const progressItem = document.getElementById(`progress_${fileId}`);
    if (progressItem) {
        progressItem.remove();
    }
    
    // 如果没有进度项了，隐藏整个进度容器
    const progressList = document.getElementById('progressList');
    if (progressList.children.length === 0) {
        document.getElementById('transferProgress').classList.add('hidden');
    }
}
