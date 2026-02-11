// 济南就业参考 - 前端应用
(function() {
    'use strict';

    const CONFIG = {
        dataPath: 'data/',
        chunksCount: 11,
        pageSize: 20,
        githubRepo: 'DragonGod9527/jinan-jobs'
    };

    // SVG 图标集
    const ICONS = {
        comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
        user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    };

    let allPosts = [];
    let companies = [];
    let currentPage = 1;
    let currentTab = 'hot';
    let searchKeyword = '';
    let filteredPosts = [];
    let loadedChunks = 0;
    let isFullyLoaded = false;

    const el = {
        searchInput: document.getElementById('searchInput'),
        searchBtn: document.getElementById('searchBtn'),
        statsText: document.getElementById('statsText'),
        postsList: document.getElementById('postsList'),
        companiesList: document.getElementById('companiesList'),
        postsSection: document.getElementById('postsSection'),
        companiesSection: document.getElementById('companiesSection'),
        pagination: document.getElementById('pagination'),
        loading: document.getElementById('loading'),
        totalCompanies: document.getElementById('totalCompanies'),
        listView: document.getElementById('listView'),
        postDetailSection: document.getElementById('postDetailSection'),
        postDetailBody: document.getElementById('postDetailBody'),
        postDetailComments: document.getElementById('postDetailComments'),
        backToList: document.getElementById('backToList'),
        loadProgress: document.getElementById('loadProgress'),
        loadProgressBar: document.getElementById('loadProgressBar'),
        loadProgressText: document.getElementById('loadProgressText')
    };

    // ==================== 初始化 ====================
    async function init() {
        try {
            await loadDataProgressive();
            bindEvents();
            handleRoute(); // 根据当前 hash 路由渲染
        } catch (error) {
            console.error('初始化失败:', error);
            el.loading.innerHTML = '<p style="color:#ef4444;padding:40px">加载失败，请刷新重试</p>';
        }
    }

    // ==================== 按需加载数据 ====================
    async function loadDataProgressive() {
        // 第一步：加载 companies.json + posts_1.json（首屏数据）
        const [companiesRes, posts1Res] = await Promise.all([
            fetch(CONFIG.dataPath + 'companies.json').then(r => r.json()),
            fetch(CONFIG.dataPath + 'posts_1.json').then(r => r.json())
        ]);

        companies = companiesRes;
        allPosts = posts1Res;
        loadedChunks = 1;

        // 尝试加载 issues
        try {
            const issuesRes = await fetch(CONFIG.dataPath + 'issues.json');
            const issues = await issuesRes.json();
            if (issues && issues.length > 0) {
                allPosts = [...issues, ...allPosts];
            }
        } catch (e) {
            console.log('暂无新帖子');
        }

        // 更新统计和隐藏loading
        updateStats();
        el.loading.classList.add('hidden');
        el.totalCompanies.textContent = companies.length;

        // 显示进度条
        el.loadProgress.classList.remove('hidden');
        updateProgressBar();

        // 第二步：后台逐个加载 posts_2 到 posts_11
        loadRemainingChunks();
    }

    async function loadRemainingChunks() {
        for (let i = 2; i <= CONFIG.chunksCount; i++) {
            try {
                const chunk = await fetch(CONFIG.dataPath + `posts_${i}.json`).then(r => r.json());
                allPosts = allPosts.concat(chunk);
                loadedChunks = i;
                updateStats();
                updateProgressBar();

                // 每加载完一个分片，如果当前在列表视图就刷新
                if (!el.postDetailSection.classList.contains('hidden')) {
                    // 在详情页，不刷新列表
                } else {
                    renderCurrentView();
                }
            } catch (e) {
                console.error(`加载 posts_${i}.json 失败:`, e);
            }
        }

        // 全部加载完成
        isFullyLoaded = true;
        el.loadProgress.classList.add('hidden');
        renderCurrentView();
    }

    function updateStats() {
        const loadingText = isFullyLoaded ? '' : ` (加载中 ${loadedChunks}/${CONFIG.chunksCount})`;
        el.statsText.textContent = `共收录 ${companies.length} 家公司，${allPosts.length} 条评价${loadingText}`;
    }

    function updateProgressBar() {
        const pct = (loadedChunks / CONFIG.chunksCount) * 100;
        el.loadProgressBar.style.width = pct + '%';
        el.loadProgressText.textContent = `数据加载中 ${loadedChunks}/${CONFIG.chunksCount}...`;
        if (isFullyLoaded) {
            el.loadProgressText.textContent = '加载完成';
        }
    }

    function renderCurrentView() {
        if (currentTab === 'companies') {
            renderCompanies();
        } else {
            renderPosts();
        }
    }

    // ==================== Hash 路由 ====================
    function handleRoute() {
        const hash = window.location.hash;

        if (hash.startsWith('#/post/')) {
            const postId = decodeURIComponent(hash.slice(7));
            showPostDetailByRoute(postId);
        } else if (hash.startsWith('#/search/')) {
            const keyword = decodeURIComponent(hash.slice(9));
            el.searchInput.value = keyword;
            searchKeyword = keyword.toLowerCase();
            currentPage = 1;
            showListView();
            renderPosts();
        } else {
            // 默认列表视图
            showListView();
            renderPosts();
        }
    }

    function showListView() {
        el.listView.classList.remove('hidden');
        el.postDetailSection.classList.add('hidden');
        document.body.style.overflow = '';
    }

    function showDetailView() {
        el.listView.classList.add('hidden');
        el.postDetailSection.classList.remove('hidden');
        window.scrollTo({ top: 0 });
    }

    function showPostDetailByRoute(postId) {
        const post = allPosts.find(p => String(p.id) === String(postId));
        if (post) {
            showPostDetail(post);
        } else {
            // 帖子可能还没加载到，显示loading并等待
            showDetailView();
            el.postDetailBody.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p>正在加载帖子数据...</p>
                </div>
            `;
            // 设置一个轮询，等数据加载完后重试
            const checkInterval = setInterval(() => {
                const p = allPosts.find(p => String(p.id) === String(postId));
                if (p) {
                    clearInterval(checkInterval);
                    showPostDetail(p);
                } else if (isFullyLoaded) {
                    clearInterval(checkInterval);
                    el.postDetailBody.innerHTML = `
                        <div style="text-align: center; padding: 60px; color: var(--gray-500);">
                            <p style="font-size: 48px; margin-bottom: 20px;">😕</p>
                            <p>未找到该帖子</p>
                            <button class="back-btn" onclick="window.location.hash=''">← 返回首页</button>
                        </div>
                    `;
                }
            }, 500);
        }
    }

    // ==================== 绑定事件 ====================
    function bindEvents() {
        el.searchBtn.addEventListener('click', handleSearch);
        el.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });

        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTab = tab.dataset.tab;
                currentPage = 1;

                if (currentTab === 'companies') {
                    el.postsSection.classList.add('hidden');
                    el.companiesSection.classList.remove('hidden');
                    renderCompanies();
                } else {
                    el.postsSection.classList.remove('hidden');
                    el.companiesSection.classList.add('hidden');
                    renderPosts();
                }
            });
        });

        // 返回按钮
        el.backToList.addEventListener('click', () => {
            window.history.back();
        });

        // 监听 hash 变化（浏览器前进/后退）
        window.addEventListener('hashchange', handleRoute);
    }

    // ==================== 搜索处理 ====================
    function handleSearch() {
        searchKeyword = el.searchInput.value.trim().toLowerCase();
        currentPage = 1;

        // 更新 hash 路由
        if (searchKeyword) {
            window.location.hash = '#/search/' + encodeURIComponent(searchKeyword);
        } else {
            window.location.hash = '';
        }
    }

    // ==================== 渲染帖子列表 ====================
    function renderPosts() {
        filteredPosts = allPosts.filter(post => {
            if (!searchKeyword) return true;
            return post.content && post.content.toLowerCase().includes(searchKeyword);
        });

        if (currentTab === 'hot') {
            filteredPosts.sort((a, b) => (b.uv || 0) - (a.uv || 0));
        } else {
            filteredPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        const totalPages = Math.ceil(filteredPosts.length / CONFIG.pageSize);
        const start = (currentPage - 1) * CONFIG.pageSize;
        const pagePosts = filteredPosts.slice(start, start + CONFIG.pageSize);

        if (pagePosts.length === 0) {
            el.postsList.innerHTML = `
                <div style="text-align:center;padding:60px 20px;color:#9ca3af">
                    <p style="margin-bottom:8px">${ICONS.search}</p>
                    <p>没有找到相关内容</p>
                </div>
            `;
            el.pagination.innerHTML = '';
            return;
        }

        el.postsList.innerHTML = pagePosts.map(post => {
            const companyMatch = post.content ? post.content.match(/####\s*(.+?)[\n\r]/) : null;
            const companyName = companyMatch ? companyMatch[1].trim() : '匿名评价';
            const contentPreview = post.content ?
                post.content.replace(/####.+?\n/, '').replace(/\n/g, ' ').substring(0, 150) + '...' : '';
            const date = post.created_at ? new Date(post.created_at).toLocaleDateString('zh-CN') : '';
            const repliesCount = post.replies ? post.replies.length : 0;

            // 发帖人信息
            let authorHtml = '';
            if (post.author) {
                const authorName = esc(post.author);
                const avatarUrl = `https://github.com/${encodeURIComponent(post.author)}.png?size=40`;
                authorHtml = `<span class="post-author" onclick="event.stopPropagation()"><img src="${avatarUrl}" alt="" class="author-avatar" onerror="this.style.display='none'"><a href="https://github.com/${encodeURIComponent(post.author)}" target="_blank">${authorName}</a></span>`;
            }

            return `
                <article class="post-card" data-id="${post.id}">
                    <div class="post-header">
                        <h3 class="post-company">${esc(companyName)}</h3>
                        <span class="post-date">${date}</span>
                    </div>
                    <p class="post-content">${esc(contentPreview)}</p>
                    <div class="post-footer">
                        ${authorHtml}
                        <div class="post-stats">
                            <span class="stat">${ICONS.comment} ${repliesCount}</span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        // 绑定点击事件 → 修改 hash
        document.querySelectorAll('.post-card').forEach(card => {
            card.addEventListener('click', () => {
                const postId = card.dataset.id;
                window.location.hash = '#/post/' + encodeURIComponent(postId);
            });
        });

        renderPagination(totalPages);
    }

    // ==================== 渲染公司列表 ====================
    function renderCompanies() {
        let filtered = companies;

        if (searchKeyword) {
            filtered = companies.filter(c =>
                c.name.toLowerCase().includes(searchKeyword)
            );
        }

        el.companiesList.innerHTML = filtered.map(company => `
            <div class="company-card" data-name="${esc(company.name)}">
                <h3 class="company-name">${esc(company.name)}</h3>
            </div>
        `).join('');

        document.querySelectorAll('.company-card').forEach(card => {
            card.addEventListener('click', () => {
                const name = card.dataset.name;
                el.searchInput.value = name;
                searchKeyword = name.toLowerCase();

                // 切换到帖子标签
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelector('.tab[data-tab="hot"]').classList.add('active');
                currentTab = 'hot';
                currentPage = 1;

                el.postsSection.classList.remove('hidden');
                el.companiesSection.classList.add('hidden');

                window.location.hash = '#/search/' + encodeURIComponent(searchKeyword);
            });
        });
    }

    // ==================== 渲染分页 ====================
    function renderPagination(totalPages) {
        if (totalPages <= 1) {
            el.pagination.innerHTML = '';
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
            if (startPage > 2) html += `<span class="ellipsis">...</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="ellipsis">...</span>`;
            html += `<button data-page="${totalPages}">${totalPages}</button>`;
        }

        html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">下一页 ›</button>`;

        el.pagination.innerHTML = html;

        el.pagination.querySelectorAll('button:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                renderPosts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    // ==================== 帖子详情页（独立页面模式） ====================
    function showPostDetail(post) {
        const companyMatch = post.content ? post.content.match(/####\s*(.+?)[\n\r]/) : null;
        const companyName = companyMatch ? companyMatch[1].trim() : '匿名评价';

        const addressMatch = post.content ? post.content.match(/\n(.+?)\n主要业务/) : null;
        const address = addressMatch ? addressMatch[1].trim() : '';

        // 用 marked 渲染 Markdown
        const contentClean = post.content ? post.content.trim() : '';
        let contentHtml = '';
        if (typeof marked !== 'undefined' && marked.parse) {
            contentHtml = marked.parse(contentClean);
        } else {
            contentHtml = '<pre>' + esc(contentClean) + '</pre>';
        }

        // 发帖人信息
        let authorHtml = '';
        if (post.author) {
            const authorName = esc(post.author);
            const avatarUrl = `https://github.com/${encodeURIComponent(post.author)}.png?size=48`;
            authorHtml = `
                <a class="modal-author" href="https://github.com/${encodeURIComponent(post.author)}" target="_blank">
                    <img src="${avatarUrl}" alt="" onerror="this.style.display='none'">
                    <span>${authorName}</span>
                </a>
            `;
        }

        // 评论区
        let repliesHtml = '';
        if (post.replies && post.replies.length > 0) {
            repliesHtml = `
                <div class="detail-replies">
                    <h3>${ICONS.comment} ${post.replies.length} 条历史评论</h3>
                    ${post.replies.map(reply => {
                        let replyContent = '';
                        if (typeof marked !== 'undefined' && marked.parse) {
                            replyContent = marked.parse(reply.content || '');
                        } else {
                            replyContent = esc(reply.content || '');
                        }

                        let replyAuthorHtml = '';
                        if (reply.author) {
                            const replyAvatarUrl = `https://github.com/${encodeURIComponent(reply.author)}.png?size=40`;
                            replyAuthorHtml = `
                                <div class="reply-header">
                                    <img src="${replyAvatarUrl}" alt="" class="reply-author-avatar" onerror="this.style.display='none'">
                                    <span class="reply-author-name">${esc(reply.author)}</span>
                                </div>
                            `;
                        }

                        return `
                            <div class="reply-item">
                                ${replyAuthorHtml}
                                <div class="reply-content">${replyContent}</div>
                                <p class="reply-time">${reply.created_at ? new Date(reply.created_at).toLocaleString('zh-CN') : ''}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        const date = post.created_at ? new Date(post.created_at).toLocaleDateString('zh-CN') : '';

        el.postDetailBody.innerHTML = `
            <h2 class="detail-company">${esc(companyName)}</h2>
            ${authorHtml}
            ${address ? `<p class="detail-address">${ICONS.pin} ${esc(address)}</p>` : ''}
            <div class="detail-meta">
                <span>📅 ${date}</span>
                <span>💬 ${post.replies ? post.replies.length : 0} 评论</span>
            </div>
            <div class="detail-content markdown-body">${contentHtml}</div>
            ${repliesHtml}
        `;

        showDetailView();

        // 加载 Giscus 评论
        loadGiscusComments(post.id, companyName);
    }

    // ==================== 加载 Giscus 评论 ====================
    function loadGiscusComments(postId, companyName) {
        const commentsEl = el.postDetailComments;
        if (!commentsEl) return;

        const discussionTerm = `post-${postId}`;

        commentsEl.innerHTML = `
            <div class="giscus-wrapper">
                <h3 class="comments-title">${ICONS.comment} 发表评论</h3>
                <p class="comments-hint">登录 GitHub 即可评论</p>
                <div class="giscus-skeleton">
                    <div class="skeleton-avatar"></div>
                    <div class="skeleton-content">
                        <div class="skeleton-line skeleton-line-short"></div>
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line skeleton-line-medium"></div>
                    </div>
                </div>
                <div class="giscus"></div>
            </div>
        `;

        const script = document.createElement('script');
        script.src = 'https://giscus.app/client.js';
        script.setAttribute('data-repo', 'DragonGod9527/jinan-jobs');
        script.setAttribute('data-repo-id', 'R_kgDORL3m9g');
        script.setAttribute('data-category', 'General');
        script.setAttribute('data-category-id', 'DIC_kwDORL3m9s4C2E7A');
        script.setAttribute('data-mapping', 'specific');
        script.setAttribute('data-term', discussionTerm);
        script.setAttribute('data-strict', '0');
        script.setAttribute('data-reactions-enabled', '1');
        script.setAttribute('data-emit-metadata', '0');
        script.setAttribute('data-input-position', 'bottom');
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        script.setAttribute('data-theme', isDark ? 'dark_dimmed' : 'light');
        script.setAttribute('data-lang', 'zh-CN');
        script.setAttribute('data-loading', 'lazy');
        script.setAttribute('crossorigin', 'anonymous');
        script.async = true;

        // Giscus 加载完成后隐藏骨架屏
        window.addEventListener('message', function hideSkeletonHandler(event) {
            if (event.origin === 'https://giscus.app') {
                const skeleton = commentsEl.querySelector('.giscus-skeleton');
                if (skeleton) skeleton.style.display = 'none';
                window.removeEventListener('message', hideSkeletonHandler);
            }
        });

        commentsEl.querySelector('.giscus').appendChild(script);
    }

    // ==================== 工具函数 ====================
    function esc(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== 主题切换 ====================
    function initTheme() {
        const saved = localStorage.getItem('theme');
        if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }

        const toggle = document.getElementById('themeToggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                if (isDark) {
                    document.documentElement.removeAttribute('data-theme');
                    localStorage.setItem('theme', 'light');
                } else {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    localStorage.setItem('theme', 'dark');
                }
                // 同步 Giscus 主题
                const giscusFrame = document.querySelector('iframe.giscus-frame');
                if (giscusFrame) {
                    giscusFrame.contentWindow.postMessage({
                        giscus: { setConfig: { theme: isDark ? 'light' : 'dark_dimmed' } }
                    }, 'https://giscus.app');
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        init();
    });
})();
