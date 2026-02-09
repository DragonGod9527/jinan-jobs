// 济南就业参考 - 前端应用
(function() {
    'use strict';

    // 配置
    const CONFIG = {
        dataPath: 'data/',
        chunksCount: 11,
        pageSize: 20,
        githubRepo: 'DragonGod9527/jinan-jobs' // GitHub仓库
    };

    // 状态
    let allPosts = [];
    let companies = [];
    let currentPage = 1;
    let currentTab = 'hot';
    let searchKeyword = '';
    let filteredPosts = [];

    // DOM元素
    const elements = {
        searchInput: document.getElementById('searchInput'),
        searchBtn: document.getElementById('searchBtn'),
        statsText: document.getElementById('statsText'),
        postsList: document.getElementById('postsList'),
        companiesList: document.getElementById('companiesList'),
        postsSection: document.getElementById('postsSection'),
        companiesSection: document.getElementById('companiesSection'),
        pagination: document.getElementById('pagination'),
        loading: document.getElementById('loading'),
        modal: document.getElementById('postModal'),
        modalBody: document.getElementById('modalBody'),
        modalClose: document.getElementById('modalClose'),
        totalCompanies: document.getElementById('totalCompanies')
    };

    // 初始化
    async function init() {
        try {
            await loadData();
            bindEvents();
            renderPosts();
        } catch (error) {
            console.error('初始化失败:', error);
            elements.loading.innerHTML = '<p style="color: #ef4444;">加载失败，请刷新重试</p>';
        }
    }

    // 加载数据
    async function loadData() {
        // 加载公司索引
        const companiesRes = await fetch(CONFIG.dataPath + 'companies.json');
        companies = await companiesRes.json();
        
        // 加载所有帖子分片
        const loadPromises = [];
        for (let i = 1; i <= CONFIG.chunksCount; i++) {
            loadPromises.push(
                fetch(CONFIG.dataPath + `posts_${i}.json`).then(r => r.json())
            );
        }
        
        const chunks = await Promise.all(loadPromises);
        allPosts = chunks.flat();
        
        // 加载Issues新帖子
        try {
            const issuesRes = await fetch(CONFIG.dataPath + 'issues.json');
            const issues = await issuesRes.json();
            if (issues && issues.length > 0) {
                // 把Issues转换为帖子格式并添加到列表
                allPosts = [...issues, ...allPosts];
                console.log(`加载了 ${issues.length} 条新帖子`);
            }
        } catch (e) {
            console.log('暂无新帖子');
        }
        
        // 更新统计
        elements.statsText.textContent = `共收录 ${companies.length} 家公司，${allPosts.length} 条评价`;
        elements.totalCompanies.textContent = companies.length;
        elements.loading.classList.add('hidden');
    }

    // 绑定事件
    function bindEvents() {
        // 搜索
        elements.searchBtn.addEventListener('click', handleSearch);
        elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });

        // 标签页切换
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTab = tab.dataset.tab;
                currentPage = 1;
                
                if (currentTab === 'companies') {
                    elements.postsSection.classList.add('hidden');
                    elements.companiesSection.classList.remove('hidden');
                    renderCompanies();
                } else {
                    elements.postsSection.classList.remove('hidden');
                    elements.companiesSection.classList.add('hidden');
                    renderPosts();
                }
            });
        });

        // 弹窗关闭
        elements.modalClose.addEventListener('click', closeModal);
        elements.modal.addEventListener('click', (e) => {
            if (e.target === elements.modal) closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    }

    // 搜索处理
    function handleSearch() {
        searchKeyword = elements.searchInput.value.trim().toLowerCase();
        currentPage = 1;
        
        if (currentTab === 'companies') {
            renderCompanies();
        } else {
            renderPosts();
        }
    }

    // 渲染帖子列表
    function renderPosts() {
        // 过滤
        filteredPosts = allPosts.filter(post => {
            if (!searchKeyword) return true;
            return post.content && post.content.toLowerCase().includes(searchKeyword);
        });

        // 排序
        if (currentTab === 'hot') {
            filteredPosts.sort((a, b) => (b.uv || 0) - (a.uv || 0));
        } else {
            filteredPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        // 分页
        const totalPages = Math.ceil(filteredPosts.length / CONFIG.pageSize);
        const start = (currentPage - 1) * CONFIG.pageSize;
        const pagePosts = filteredPosts.slice(start, start + CONFIG.pageSize);

        // 渲染
        if (pagePosts.length === 0) {
            elements.postsList.innerHTML = `
                <div style="text-align: center; padding: 60px; color: #64748b;">
                    <p style="font-size: 48px; margin-bottom: 20px;">🔍</p>
                    <p>没有找到相关内容</p>
                </div>
            `;
            elements.pagination.innerHTML = '';
            return;
        }

        elements.postsList.innerHTML = pagePosts.map(post => {
            const companyMatch = post.content ? post.content.match(/####\s*(.+?)[\n\r]/) : null;
            const companyName = companyMatch ? companyMatch[1].trim() : '匿名评价';
            const contentPreview = post.content ? 
                post.content.replace(/####.+?\n/, '').replace(/\n/g, ' ').substring(0, 150) + '...' : '';
            const date = post.created_at ? new Date(post.created_at).toLocaleDateString('zh-CN') : '';
            const repliesCount = post.replies ? post.replies.length : 0;

            return `
                <article class="post-card" data-id="${post.id}">
                    <div class="post-header">
                        <h3 class="post-company">${escapeHtml(companyName)}</h3>
                        <span class="post-meta">${date}</span>
                    </div>
                    <p class="post-content">${escapeHtml(contentPreview)}</p>
                    <div class="post-stats">
                        <span>👁️ ${post.uv || 0} 浏览</span>
                        <span>💬 ${repliesCount} 评论</span>
                    </div>
                </article>
            `;
        }).join('');

        // 绑定点击事件
        document.querySelectorAll('.post-card').forEach(card => {
            card.addEventListener('click', () => {
                const postId = card.dataset.id;
                const post = allPosts.find(p => p.id === postId);
                if (post) showPostDetail(post);
            });
        });

        // 渲染分页
        renderPagination(totalPages);
    }

    // 渲染公司列表
    function renderCompanies() {
        let filtered = companies;
        
        if (searchKeyword) {
            filtered = companies.filter(c => 
                c.name.toLowerCase().includes(searchKeyword)
            );
        }

        elements.companiesList.innerHTML = filtered.map(company => `
            <div class="company-card" data-name="${escapeHtml(company.name)}">
                <h3 class="company-name">${escapeHtml(company.name)}</h3>
                <p class="company-views">👁️ ${company.uv || 0} 浏览</p>
            </div>
        `).join('');

        // 绑定点击
        document.querySelectorAll('.company-card').forEach(card => {
            card.addEventListener('click', () => {
                const name = card.dataset.name;
                elements.searchInput.value = name;
                searchKeyword = name.toLowerCase();
                
                // 切换到帖子标签
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelector('.tab[data-tab="hot"]').classList.add('active');
                currentTab = 'hot';
                currentPage = 1;
                
                elements.postsSection.classList.remove('hidden');
                elements.companiesSection.classList.add('hidden');
                renderPosts();
            });
        });
    }

    // 渲染分页
    function renderPagination(totalPages) {
        if (totalPages <= 1) {
            elements.pagination.innerHTML = '';
            return;
        }

        let html = '';
        
        // 上一页
        html += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹ 上一页</button>`;
        
        // 页码
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            html += `<button data-page="1">1</button>`;
            if (startPage > 2) html += `<span style="padding: 0 10px;">...</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span style="padding: 0 10px;">...</span>`;
            html += `<button data-page="${totalPages}">${totalPages}</button>`;
        }

        // 下一页
        html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">下一页 ›</button>`;

        elements.pagination.innerHTML = html;

        // 绑定分页点击
        elements.pagination.querySelectorAll('button:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                renderPosts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    // 显示帖子详情
    function showPostDetail(post) {
        const companyMatch = post.content ? post.content.match(/####\s*(.+?)[\n\r]/) : null;
        const companyName = companyMatch ? companyMatch[1].trim() : '匿名评价';
        
        const addressMatch = post.content ? post.content.match(/\n(.+?)\n主要业务/) : null;
        const address = addressMatch ? addressMatch[1].trim() : '';
        
        const contentClean = post.content ? 
            post.content.replace(/####.+?\n/, '').trim() : '';

        let repliesHtml = '';
        if (post.replies && post.replies.length > 0) {
            repliesHtml = `
                <div class="modal-replies">
                    <h3>💬 ${post.replies.length} 条评论</h3>
                    ${post.replies.map(reply => `
                        <div class="reply-item">
                            <p class="reply-content">${escapeHtml(reply.content || '')}</p>
                            <p class="reply-time">${reply.created_at ? new Date(reply.created_at).toLocaleString('zh-CN') : ''}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        elements.modalBody.innerHTML = `
            <h2 class="modal-company">${escapeHtml(companyName)}</h2>
            ${address ? `<p class="modal-address">📍 ${escapeHtml(address)}</p>` : ''}
            <div class="modal-content-text">${escapeHtml(contentClean)}</div>
            ${repliesHtml}
        `;

        elements.modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // 加载评论
        loadGiscusComments(post.id, companyName);
    }

    // 关闭弹窗
    function closeModal() {
        elements.modal.classList.remove('show');
        document.body.style.overflow = '';
        // 清除评论区
        const commentsEl = document.getElementById('modalComments');
        if (commentsEl) commentsEl.innerHTML = '';
    }

    // 加载Giscus评论
    function loadGiscusComments(postId, companyName) {
        const commentsEl = document.getElementById('modalComments');
        if (!commentsEl) return;
        
        // 清除旧评论
        commentsEl.innerHTML = `
            <div class="giscus-wrapper">
                <h3 class="comments-title">💬 发表评论</h3>
                <p class="comments-hint">登录 GitHub 即可评论，支持 Markdown 格式</p>
                <div class="giscus"></div>
            </div>
        `;
        
        // 动态创建Giscus iframe
        const script = document.createElement('script');
        script.src = 'https://giscus.app/client.js';
        script.setAttribute('data-repo', 'DragonGod9527/jinan-jobs');
        script.setAttribute('data-repo-id', 'R_kgDORL3m9g');
        script.setAttribute('data-category', 'General');
        script.setAttribute('data-category-id', 'DIC_kwDORL3m9s4C2E7A');
        script.setAttribute('data-mapping', 'specific');
        script.setAttribute('data-term', companyName || postId);
        script.setAttribute('data-strict', '0');
        script.setAttribute('data-reactions-enabled', '1');
        script.setAttribute('data-emit-metadata', '0');
        script.setAttribute('data-input-position', 'top');
        script.setAttribute('data-theme', 'light');
        script.setAttribute('data-lang', 'zh-CN');
        script.setAttribute('data-loading', 'lazy');
        script.setAttribute('crossorigin', 'anonymous');
        script.async = true;
        
        commentsEl.querySelector('.giscus').appendChild(script);
    }

    // HTML转义
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 启动
    document.addEventListener('DOMContentLoaded', init);
})();
