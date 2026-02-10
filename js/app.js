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
        modal: document.getElementById('postModal'),
        modalBody: document.getElementById('modalBody'),
        modalClose: document.getElementById('modalClose'),
        totalCompanies: document.getElementById('totalCompanies')
    };

    // ========== 初始化 ==========
    async function init() {
        try {
            await loadData();
            bindEvents();
            renderPosts();
        } catch (error) {
            console.error('初始化失败:', error);
            el.loading.innerHTML = '<p style="color:#ef4444;padding:40px">加载失败，请刷新重试</p>';
        }
    }

    // ========== 加载数据 ==========
    async function loadData() {
        const companiesRes = await fetch(CONFIG.dataPath + 'companies.json');
        companies = await companiesRes.json();

        const loadPromises = [];
        for (let i = 1; i <= CONFIG.chunksCount; i++) {
            loadPromises.push(
                fetch(CONFIG.dataPath + `posts_${i}.json`).then(r => r.json())
            );
        }

        const chunks = await Promise.all(loadPromises);
        allPosts = chunks.flat();

        // 加载 Issues 新帖子
        try {
            const issuesRes = await fetch(CONFIG.dataPath + 'issues.json');
            const issues = await issuesRes.json();
            if (issues && issues.length > 0) {
                allPosts = [...issues, ...allPosts];
            }
        } catch (e) {
            console.log('暂无新帖子');
        }

        el.statsText.textContent = `共收录 ${companies.length} 家公司，${allPosts.length} 条评价`;
        el.totalCompanies.textContent = companies.length;
        el.loading.classList.add('hidden');
    }

    // ========== 绑定事件 ==========
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

        el.modalClose.addEventListener('click', closeModal);
        el.modal.addEventListener('click', (e) => {
            if (e.target === el.modal) closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    }

    // ========== 搜索 ==========
    function handleSearch() {
        searchKeyword = el.searchInput.value.trim().toLowerCase();
        currentPage = 1;
        if (currentTab === 'companies') {
            renderCompanies();
        } else {
            renderPosts();
        }
    }

    // ========== 渲染帖子 ==========
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
                post.content.replace(/####.+?\n/, '').replace(/\n/g, ' ').substring(0, 120) + '...' : '';
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

        document.querySelectorAll('.post-card').forEach(card => {
            card.addEventListener('click', () => {
                const post = allPosts.find(p => p.id === card.dataset.id);
                if (post) showPostDetail(post);
            });
        });

        renderPagination(totalPages);
    }

    // ========== 渲染公司列表 ==========
    function renderCompanies() {
        let filtered = companies;
        if (searchKeyword) {
            filtered = companies.filter(c => c.name.toLowerCase().includes(searchKeyword));
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

                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelector('.tab[data-tab="hot"]').classList.add('active');
                currentTab = 'hot';
                currentPage = 1;

                el.postsSection.classList.remove('hidden');
                el.companiesSection.classList.add('hidden');
                renderPosts();
            });
        });
    }

    // ========== 渲染分页 ==========
    function renderPagination(totalPages) {
        if (totalPages <= 1) {
            el.pagination.innerHTML = '';
            return;
        }

        let html = '';
        html += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">上一页</button>`;

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

        html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">下一页</button>`;

        el.pagination.innerHTML = html;

        el.pagination.querySelectorAll('button:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                renderPosts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    // ========== 帖子详情 ==========
    function showPostDetail(post) {
        const companyMatch = post.content ? post.content.match(/####\s*(.+?)[\n\r]/) : null;
        const companyName = companyMatch ? companyMatch[1].trim() : '匿名评价';

        const addressMatch = post.content ? post.content.match(/\n(.+?)\n主要业务/) : null;
        const address = addressMatch ? addressMatch[1].trim() : '';

        const contentClean = post.content ?
            post.content.replace(/####.+?\n/, '').trim() : '';

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
                <div class="modal-replies">
                    <h3>${ICONS.comment} ${post.replies.length} 条历史评论</h3>
                    ${post.replies.map(reply => {
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
                                <p class="reply-content">${esc(reply.content || '')}</p>
                                <p class="reply-time">${reply.created_at ? new Date(reply.created_at).toLocaleString('zh-CN') : ''}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        el.modalBody.innerHTML = `
            <h2 class="modal-company">${esc(companyName)}</h2>
            ${authorHtml}
            ${address ? `<p class="modal-address">${ICONS.pin} ${esc(address)}</p>` : ''}
            <div class="modal-content-text">${esc(contentClean)}</div>
            ${repliesHtml}
        `;

        el.modal.classList.add('show');
        document.body.style.overflow = 'hidden';

        loadGiscusComments(post.id, companyName);
    }

    // ========== 关闭弹窗 ==========
    function closeModal() {
        el.modal.classList.remove('show');
        document.body.style.overflow = '';
        const commentsEl = document.getElementById('modalComments');
        if (commentsEl) commentsEl.innerHTML = '';
    }

    // ========== Giscus 评论 ==========
    function loadGiscusComments(postId, companyName) {
        const commentsEl = document.getElementById('modalComments');
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

        window.addEventListener('message', function handler(event) {
            if (event.origin === 'https://giscus.app') {
                const skeleton = commentsEl.querySelector('.giscus-skeleton');
                if (skeleton) skeleton.style.display = 'none';
                window.removeEventListener('message', handler);
            }
        });

        commentsEl.querySelector('.giscus').appendChild(script);
    }

    // ========== 工具函数 ==========
    function esc(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== 主题切换 ==========
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
