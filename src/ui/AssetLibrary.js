// src/ui/AssetLibrary.js
export class AssetLibrary {
  constructor(btnEl, panelEl, closeBtnEl, categoriesEl, assetsEl) {
    this.btn = btnEl;
    this.panel = panelEl;
    this.closeBtn = closeBtnEl;
    this.categoriesContainer = categoriesEl;
    this.assetsGrid = assetsEl;
    this.catalog = [];
    this.onSelectCallback = null;
    this.activeCategory = '';

    this.btn.addEventListener('click', () => this.show());
    this.closeBtn.addEventListener('click', () => this.hide());
  }

  onSelect(callback) {
    this.onSelectCallback = callback;
  }

  show() {
    this.panel.classList.remove('hidden');
    this.panel.classList.add('visible');
  }

  hide() {
    this.panel.classList.remove('visible');
    this.panel.classList.add('hidden');
  }

  setCatalog(catalog) {
    this.catalog = catalog;
    this.render();
  }

  render() {
    const categories = [...new Set(this.catalog.map(item => item.category))];
    
    this.categoriesContainer.innerHTML = '';
    categories.forEach(category => {
      const button = document.createElement('button');
      button.className = 'category-btn';
      button.textContent = category;
      button.dataset.category = category;
      button.addEventListener('click', () => this.setActiveCategory(category));
      this.categoriesContainer.appendChild(button);
    });

    if (categories.length > 0) {
      this.setActiveCategory(categories[0]);
    }
  }

  setActiveCategory(category) {
    this.activeCategory = category;

    // Update button styles
    const buttons = this.categoriesContainer.querySelectorAll('.category-btn');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });

    // Filter and render assets
    this.assetsGrid.innerHTML = '';
    const assets = this.catalog.filter(item => item.category === category);
    assets.forEach((asset, index) => {
      const card = document.createElement('div');
      card.className = 'asset-card';
      
      const preview = document.createElement('div');
      preview.className = 'preview';
      preview.style.backgroundColor = asset.preview; // Use preview color

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = asset.name;

      card.appendChild(preview);
      card.appendChild(name);

      card.addEventListener('click', () => {
        if (this.onSelectCallback) {
          this.onSelectCallback(asset);
          this.hide();
        }
      });

      this.assetsGrid.appendChild(card);
    });
  }
}

