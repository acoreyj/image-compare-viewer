interface LabelOptions {
  before: string;
  after: string;
  onHover: boolean;
}

interface ImageCompareOptions {
  controlColor?: string;
  controlShadow?: boolean;
  addCircle?: boolean;
  addCircleBlur?: boolean;
  showLabels?: boolean;
  labelOptions?: LabelOptions;
  smoothing?: boolean;
  smoothingAmount?: number;
  hoverStart?: boolean;
  verticalMode?: boolean;
  startingPoint?: number;
  fluidMode?: boolean;
}

const DEFAULTS: Required<ImageCompareOptions> = {
  controlColor: "#FFFFFF",
  controlShadow: true,
  addCircle: false,
  addCircleBlur: true,
  showLabels: false,
  labelOptions: {
    before: "Before",
    after: "After",
    onHover: false,
  },
  smoothing: true,
  smoothingAmount: 100,
  hoverStart: false,
  verticalMode: false,
  startingPoint: 50,
  fluidMode: false,
};

type ArrowCoord = [number, number];

export class ImageCompare {
  private readonly settings: Required<ImageCompareOptions>;
  private readonly el: HTMLElement;
  private readonly isSafari: boolean;

  private wrapper: HTMLDivElement | null = null;
  private control: HTMLDivElement | null = null;
  private arrowAnimators: HTMLDivElement[] = [];
  private active = false;

  private readonly slideWidth = 50;
  private readonly lineWidth = 2;

  private readonly arrowCoords: Record<"circle" | "standard", ArrowCoord> = {
    circle: [5, 3],
    standard: [8, 0],
  };

  constructor(el: HTMLElement, options: ImageCompareOptions = {}) {
    this.el = el;
    this.settings = { ...DEFAULTS, ...options, labelOptions: { ...DEFAULTS.labelOptions, ...options.labelOptions } };

    this.isSafari =
      navigator.userAgent.includes("Safari") &&
      !navigator.userAgent.includes("Chrome");
  }

  mount(): void {
    if (this.isSafari) {
      this.settings.smoothing = false;
    }

    this.setupContainer();
    this.processImages();
    this.buildControl();
    this.bindEvents();
  }

  // ── Container setup ──────────────────────────────────────────

  private setupContainer(): void {
    const labelBefore = document.createElement("span");
    const labelAfter = document.createElement("span");

    labelBefore.classList.add("icv__label", "icv__label-before", "keep");
    labelAfter.classList.add("icv__label", "icv__label-after", "keep");

    if (this.settings.labelOptions.onHover) {
      labelBefore.classList.add("on-hover");
      labelAfter.classList.add("on-hover");
    }

    if (this.settings.verticalMode) {
      labelBefore.classList.add("vertical");
      labelAfter.classList.add("vertical");
    }

    labelBefore.textContent = this.settings.labelOptions.before || "Before";
    labelAfter.textContent = this.settings.labelOptions.after || "After";

    if (this.settings.showLabels) {
      this.el.appendChild(labelBefore);
      this.el.appendChild(labelAfter);
    }

    const mode = this.settings.verticalMode
      ? "icv__icv--vertical"
      : "icv__icv--horizontal";

    this.el.classList.add(
      "icv",
      mode,
      this.settings.fluidMode ? "icv__is--fluid" : "standard",
    );

    const imposter = document.createElement("div");
    imposter.classList.add("icv__imposter");
    this.el.appendChild(imposter);
  }

  // ── Image processing ─────────────────────────────────────────

  private processImages(): void {
    const children = Array.from(
      this.el.querySelectorAll("img, video, .keep"),
    ) as HTMLElement[];

    this.el.innerHTML = "";

    for (const child of children) {
      this.el.appendChild(child);
    }

    const imageElements = children.filter((el) =>
      ["img", "video"].includes(el.nodeName.toLowerCase()),
    ) as (HTMLImageElement | HTMLVideoElement)[];

    if (this.settings.verticalMode) {
      imageElements.reverse();
    }

    for (let i = 0; i < 2; i++) {
      const child = imageElements[i];
      child.classList.add("icv__img");
      child.classList.add(i === 0 ? "icv__img-a" : "icv__img-b");

      if (i === 1) {
        const wrapper = document.createElement("div");
        const afterUrl = (imageElements[1] as HTMLImageElement | HTMLVideoElement).src;

        wrapper.classList.add("icv__wrapper");

        this.applyWrapperStyles(wrapper, afterUrl);
        wrapper.appendChild(child);
        this.wrapper = wrapper;
        this.el.appendChild(wrapper);
      }
    }

    if (this.settings.fluidMode) {
      const url = (imageElements[0] as HTMLImageElement | HTMLVideoElement).src;
      const fluidWrapper = document.createElement("div");
      fluidWrapper.classList.add("icv__fluidwrapper");
      fluidWrapper.style.backgroundImage = `url(${url})`;
      this.el.appendChild(fluidWrapper);
    }

    if (imageElements[0] && imageElements[1]) {
      this.fitContainerToBoth(
        imageElements[0] as HTMLImageElement,
        imageElements[1] as HTMLImageElement,
      );
    }
  }

  private applyWrapperStyles(wrapper: HTMLDivElement, afterUrl: string): void {
    const { startingPoint, verticalMode, smoothing, smoothingAmount, fluidMode } = this.settings;
    const hasTouch = "ontouchstart" in document.documentElement;

    if (verticalMode) {
      wrapper.style.height = `${startingPoint}%`;
    } else {
      wrapper.style.width = `${100 - startingPoint}%`;
    }

    if (!hasTouch && smoothing) {
      wrapper.style.transition = `${smoothingAmount}ms ease-out`;
    }

    if (fluidMode) {
      wrapper.style.backgroundImage = `url(${afterUrl})`;
      if (verticalMode) {
        wrapper.style.clipPath = `inset(0 0 ${100 - startingPoint}% 0)`;
      } else {
        wrapper.style.clipPath = `inset(0 0 0 ${startingPoint}%)`;
      }
    }
  }

  private fitContainerToBoth(imgA: HTMLImageElement, imgB: HTMLImageElement): void {
    const setSize = (): void => {
      if (!imgA.naturalWidth || !imgB.naturalWidth) return;

      const maxWidth = Math.max(imgA.naturalWidth, imgB.naturalWidth);
      const maxHeight = Math.max(imgA.naturalHeight, imgB.naturalHeight);

      this.el.style.maxWidth = `${maxWidth}px`;
      this.el.style.aspectRatio = `${maxWidth} / ${maxHeight}`;

      imgA.style.position = "absolute";
      imgA.style.width = "100%";
      imgA.style.height = "100%";
      imgA.style.objectFit = "cover";
      imgA.style.top = "0";
      imgA.style.left = "0";
    };

    if (imgA.complete && imgB.complete) {
      setSize();
    } else {
      imgA.addEventListener("load", setSize);
      imgB.addEventListener("load", setSize);
    }
  }

  // ── Control building ─────────────────────────────────────────

  private buildControl(): void {
    const control = document.createElement("div");
    control.classList.add("icv__control");

    const dim = this.settings.verticalMode ? "top" : "left";
    control.style[this.settings.verticalMode ? "height" : "width"] = `${this.slideWidth}px`;
    control.style[dim] = `calc(${this.settings.startingPoint}% - ${this.slideWidth / 2}px)`;

    if (!("ontouchstart" in document.documentElement) && this.settings.smoothing) {
      control.style.transition = `${this.settings.smoothingAmount}ms ease-out`;
    }

    const uiLine = this.createControlLine();
    const uiLine2 = uiLine.cloneNode(true) as HTMLDivElement;

    const arrowsContainer = this.createArrows();

    if (this.settings.addCircle) {
      const circle = this.createCircle();
      control.appendChild(circle);
    }

    control.appendChild(uiLine);
    control.appendChild(arrowsContainer);
    control.appendChild(uiLine2);

    this.control = control;
    this.el.appendChild(control);
  }

  private createControlLine(): HTMLDivElement {
    const line = document.createElement("div");
    line.classList.add("icv__control-line");

    if (this.settings.verticalMode) {
      line.style.height = `${this.lineWidth}px`;
    } else {
      line.style.width = `${this.lineWidth}px`;
    }
    line.style.background = this.settings.controlColor;

    if (this.settings.controlShadow) {
      line.style.boxShadow = "0px 0px 15px rgba(0,0,0,0.33)";
    }

    return line;
  }

  private createArrows(): HTMLDivElement {
    const container = document.createElement("div");
    container.classList.add("icv__theme-wrapper");

    const coord = this.settings.addCircle
      ? this.arrowCoords.circle
      : this.arrowCoords.standard;

    for (let i = 0; i < 2; i++) {
      const animator = document.createElement("div");
      animator.classList.add("icv__arrow-wrapper");

      let rotation: number;
      if (i === 0) {
        rotation = this.settings.verticalMode ? -90 : 180;
      } else {
        rotation = this.settings.verticalMode ? 90 : 0;
      }

      const scale = this.settings.addCircle ? 0.7 : 1.5;
      const strokeWidth = this.settings.addCircle ? 3 : 0;
      const fill = this.settings.addCircle ? "transparent" : this.settings.controlColor;
      const dropDir = i === 0 ? "-3px" : "3px";

      const svg = `
        <svg height="15" width="15"
          style="transform: scale(${scale}) rotateZ(${rotation}deg);
                 height: 20px; width: 20px;
                 ${this.settings.controlShadow
                   ? `-webkit-filter: drop-shadow(0px ${dropDir} 5px rgba(0,0,0,.33));
                      filter: drop-shadow(0px ${dropDir} 5px rgba(0,0,0,.33));`
                   : ""}"
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15">
          <path fill="${fill}"
                stroke="${this.settings.controlColor}"
                stroke-linecap="round"
                stroke-width="${strokeWidth}"
                d="M4.5 1.9L10 7.65l-5.5 5.4"/>
        </svg>`;

      animator.innerHTML = svg;
      animator.style.transform = this.settings.verticalMode
        ? `translateY(${i === 0 ? coord[0] : -coord[0]}px)`
        : `translateX(${i === 0 ? coord[0] : -coord[0]}px)`;

      this.arrowAnimators.push(animator);
      container.appendChild(animator);
    }

    return container;
  }

  private createCircle(): HTMLDivElement {
    const circle = document.createElement("div");
    circle.classList.add("icv__circle");

    circle.style.border = `${this.lineWidth}px solid ${this.settings.controlColor}`;

    if (this.settings.addCircleBlur) {
      circle.style.backdropFilter = "blur(5px)";
      circle.style.setProperty("-webkit-backdrop-filter", "blur(5px)");
    }

    if (this.settings.controlShadow) {
      circle.style.boxShadow = "0px 0px 15px rgba(0,0,0,0.33)";
    }

    return circle;
  }

  // ── Events ───────────────────────────────────────────────────

  private bindEvents(): void {
    // Desktop
    this.el.addEventListener("mousedown", this.onDragStart);
    this.el.addEventListener("mousemove", this.onDragMove);
    this.el.addEventListener("mouseup", this.onDragEnd);
    document.body.addEventListener("mouseup", this.onDragEndGlobal);

    // Mobile
    this.control!.addEventListener("touchstart", this.onTouchStart, { passive: true });
    this.el.addEventListener("touchmove", this.onDragMove, { passive: false });
    this.el.addEventListener("touchend", this.onDragEndGlobal);

    // Hover arrows
    this.el.addEventListener("mouseenter", this.onHoverEnter);
    this.el.addEventListener("mouseleave", this.onHoverLeave);
  }

  private lockScroll(): void {
    document.body.classList.add("icv__body");
    document.body.style.overflow = "hidden";
  }

  private unlockScroll(): void {
    document.body.classList.remove("icv__body");
    document.body.style.overflow = "";
  }

  private readonly onDragStart = (ev: MouseEvent): void => {
    this.active = true;
    this.lockScroll();
    this.slideCompare(ev);
  };

  private readonly onTouchStart = (): void => {
    this.active = true;
    this.lockScroll();
  };

  private readonly onDragEnd = (): void => {
    this.active = false;
  };

  private readonly onDragEndGlobal = (): void => {
    this.active = false;
    this.unlockScroll();
  };

  private readonly onDragMove = (ev: MouseEvent | TouchEvent): void => {
    if (!this.active) return;
    ev.preventDefault();
    this.slideCompare(ev);
  };

  private readonly onHoverEnter = (): void => {
    if (this.settings.hoverStart) {
      this.active = true;
    }

    const coord = this.settings.addCircle
      ? this.arrowCoords.circle
      : this.arrowCoords.standard;

    this.arrowAnimators.forEach((anim, i) => {
      const offset = coord[1] * (i === 0 ? 1 : -1);
      if (this.settings.verticalMode) {
        anim.style.transform = `translateY(${offset}px)`;
      } else {
        anim.style.transform = `translateX(${offset}px)`;
      }
    });
  };

  private readonly onHoverLeave = (): void => {
    const coord = this.settings.addCircle
      ? this.arrowCoords.circle
      : this.arrowCoords.standard;

    this.arrowAnimators.forEach((anim, i) => {
      const offset = coord[0] * (i === 0 ? 1 : -1);
      if (this.settings.verticalMode) {
        anim.style.transform = `translateY(${offset}px)`;
      } else {
        anim.style.transform = `translateX(${offset}px)`;
      }
    });
  };

  // ── Slide logic ──────────────────────────────────────────────

  private slideCompare(ev: MouseEvent | TouchEvent): void {
    const bounds = this.el.getBoundingClientRect();

    let clientX: number;
    let clientY: number;

    if ("touches" in ev) {
      clientX = ev.touches[0].clientX;
      clientY = ev.touches[0].clientY;
    } else {
      clientX = ev.clientX;
      clientY = ev.clientY;
    }

    const x = clientX - bounds.left;
    const y = clientY - bounds.top;

    const position = this.settings.verticalMode
      ? (y / bounds.height) * 100
      : (x / bounds.width) * 100;

    if (position < 0 || position > 100) return;

    if (this.settings.verticalMode) {
      this.control!.style.top = `calc(${position}% - ${this.slideWidth / 2}px)`;
    } else {
      this.control!.style.left = `calc(${position}% - ${this.slideWidth / 2}px)`;
    }

    if (this.settings.fluidMode) {
      if (this.settings.verticalMode) {
        this.wrapper!.style.clipPath = `inset(0 0 ${100 - position}% 0)`;
      } else {
        this.wrapper!.style.clipPath = `inset(0 0 0 ${position}%)`;
      }
    } else {
      if (this.settings.verticalMode) {
        this.wrapper!.style.height = `${position}%`;
      } else {
        this.wrapper!.style.width = `${100 - position}%`;
      }
    }
  }
}
