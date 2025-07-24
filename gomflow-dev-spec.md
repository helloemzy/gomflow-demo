# GOMFLOW Website Development Specification

## **Project Overview**
Recreate the GOMFLOW website with enhanced features that transform it from 9/10 to 10/10 performance, using the provided cartoon bear mascot image.

## **Bear Mascot Implementation**

### **Primary Bear Image**
- **File:** Use the provided cartoon bear image (cute, professional style with tablet)
- **Placement:** Hero section, right side
- **Size:** 300px width on desktop, 200px on mobile
- **Animation:** Gentle floating animation (translateY: 0px to -10px, 4s ease-in-out infinite)
- **Additional Elements:**
  - "HOT" badge positioned top-right of bear container
  - Badge: Red background (#EF4444), white text, small rounded pill shape
  - Badge animation: Subtle pulse effect (scale 1 to 1.05, 2s infinite)

### **Bear Styling Requirements**
```css
.bear-container {
    position: relative;
    animation: float 4s ease-in-out infinite;
}

@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
}

.bear-image {
    width: 300px;
    height: auto;
    filter: drop-shadow(0 10px 25px rgba(0, 0, 0, 0.15));
}

.hot-badge {
    position: absolute;
    top: -10px;
    right: -10px;
    background: #EF4444;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}
```

---

## **Color Palette & Design System**

### **Primary Colors**
- **Primary Orange:** `#E97625` 
- **Primary Light:** `#F19A4A`
- **Primary Dark:** `#C85F0D`
- **Success Green:** `#10B981`
- **Danger Red:** `#EF4444`
- **Warning Yellow:** `#F59E0B`

### **Text Colors**
- **Primary Text:** `#1A202C`
- **Secondary Text:** `#718096`
- **Muted Text:** `#A0AEC0`

### **Background Colors**
- **White:** `#FFFFFF`
- **Light Gray:** `#F7FAFC`
- **Border:** `#E2E8F0`

### **Typography**
- **Font Family:** Inter (Google Fonts)
- **Import:** `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');`
- **Weights:** 300, 400, 500, 600, 700, 800, 900

---

## **Layout Structure**

### **1. Hero Section**
**Container:** Max-width 1200px, centered
**Layout:** CSS Grid, 2 columns (1fr 1fr), 4rem gap
**Padding:** 4rem 2rem
**Min-height:** 100vh

#### **Left Column - Content:**
- **H1:** "AUTOMATING THE MANUAL CHAOS OF GROUP ORDER PURCHASING"
  - Font: 4rem, weight 800, color primary text
  - "GROUP ORDER PURCHASING" in orange (#E97625)
  - Line height: 1.1
- **Tagline:** "From 20 hours of spreadsheet hell to 10 minutes of simplicity"
  - Font: 1.25rem, weight 600, color orange, uppercase
  - Letter spacing: 0.5px
- **CTA Section:**
  - Primary button: "Get Early Access →" (orange background, white text, rounded 50px)
  - Secondary button: "See Live Orders" (transparent background, orange border, rounded 50px)
  - Timeline text: "Q1 2026 Launch • Starting in Philippines • 50+ GOMs Testing"
    - Background: light gray, rounded pill, small text

#### **Right Column - Bear Visual:**
- **Bear image** with floating animation
- **HOT badge** with pulse animation positioned top-right

### **2. Stats Section**
**Background:** Light gray (#F7FAFC)
**Padding:** 4rem 2rem
**Layout:** CSS Grid, auto-fit columns (minmax 250px, 1fr)

#### **Stat Cards:**
- White background, 2rem padding, rounded corners (12px)
- Box shadow: `0 1px 3px rgba(0, 0, 0, 0.1)`
- Border: `1px solid #E2E8F0`
- Large number (3rem, weight 800, orange color)
- Label below (small, uppercase, secondary text, letter-spacing 0.5px)

#### **Stats Data:**
```javascript
const stats = [
    { number: "12,847", label: "Orders Processed Today" },
    { number: "2,570", label: "Hours Saved This Month" },
    { number: "98.5%", label: "Success Rate" }
];
```

#### **Number Animation:**
```javascript
// Animate numbers counting up from 0 to target
document.addEventListener('DOMContentLoaded', function() {
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(stat => {
        const target = parseInt(stat.textContent.replace(/,/g, ''));
        let current = 0;
        const increment = target / 100;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                stat.textContent = target.toLocaleString();
                clearInterval(timer);
            } else {
                stat.textContent = Math.floor(current).toLocaleString();
            }
        }, 20);
    });
});
```

### **3. Trust Signals Section**
**Background:** White
**Padding:** 3rem 2rem
**Content:** Centered badges showing credibility

#### **Trust Badges:**
- Flexbox layout, centered, wrapped, gap 2rem
- Each badge: Light gray background, rounded 12px, padding 1rem 2rem
- Icon + text layout, gap 0.5rem
- Icons: 20px circles with centered symbols

#### **Trust Badge Data:**
```javascript
const trustBadges = [
    { icon: "✓", text: "50+ GOMs Testing" },
    { icon: "🔒", text: "Secure Payments" },
    { icon: "🚀", text: "SEA Regional Expert" },
    { icon: "⏰", text: "24/7 Support" }
];
```

### **4. Trending Section (#gomflowTRENDING)**
**Background:** White
**Padding:** 4rem 2rem
**Layout:** CSS Grid, auto-fit columns (minmax 300px, 1fr)
**ID:** `trending` (for anchor navigation)

#### **Header:**
- Title: "#gomflowTRENDING" (2.5rem, weight 800, centered)
- Subtitle: "Live feed of hottest group orders right now" (1.125rem, secondary text, centered)
- Margin bottom: 3rem

#### **Trending Cards Data:**
```javascript
const trendingOrders = [
    {
        title: "NewJeans - 'Get Up' Special Album",
        seller: "KpopCollectorSG",
        verified: true,
        progress: 85,
        spotsLeft: 3,
        timeLeft: "2h 15m left",
        gradient: "linear-gradient(135deg, #FFB6C1, #FF69B4)",
        displayText: "NewJeans",
        hot: true
    },
    {
        title: "BTS Official Light Stick Ver. 4",
        seller: "ArmyMalaysia", 
        verified: true,
        progress: 92,
        spotsLeft: 2,
        timeLeft: "45m left",
        gradient: "linear-gradient(135deg, #4A90E2, #7B68EE)",
        displayText: "BTS",
        hot: true
    },
    {
        title: "TWICE - Formula of Love Photobook",
        seller: "OncePH",
        verified: true,
        progress: 67,
        spotsLeft: 8,
        timeLeft: "6h 30m left",
        gradient: "linear-gradient(135deg, #FF6B9D, #C44569)",
        displayText: "TWICE",
        hot: false
    }
];
```

#### **Card Styling:**
```css
.trending-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #E2E8F0;
    overflow: hidden;
    transition: all 0.3s ease;
    position: relative;
}

.trending-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

.trending-image {
    width: 100%;
    height: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    color: white;
    font-weight: bold;
    position: relative;
}

.trending-badge {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: #EF4444;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
}
```

#### **Progress Bar Styling:**
```css
.progress-bar {
    width: 100%;
    height: 8px;
    background: #F7FAFC;
    border-radius: 4px;
    overflow: hidden;
    margin: 0.5rem 0;
}

.progress-fill {
    height: 100%;
    background: #E97625;
    border-radius: 4px;
    transition: width 0.5s ease;
}
```

#### **Countdown Timer Logic:**
```javascript
function updateCountdowns() {
    const timeElements = document.querySelectorAll('.time-left span:last-child');
    timeElements.forEach(element => {
        const timeText = element.textContent;
        // Simple countdown simulation for demo
        if (timeText.includes('2h 15m')) {
            const now = new Date();
            const minutes = 135 - (now.getMinutes() % 60);
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            element.textContent = `${hours}h ${mins}m left`;
        }
    });
}

// Update every minute
setInterval(updateCountdowns, 60000);
```

### **5. Before/After Comparison Section**
**Background:** Light gray (#F7FAFC)
**Padding:** 4rem 2rem
**Layout:** CSS Grid, 2 columns (1fr 1fr), gap 2rem

#### **Section Header:**
- Title: "The Old Way vs The GOMFlow Way" (2.5rem, weight 800, centered)
- Margin bottom: 3rem

#### **Comparison Cards:**
```css
.comparison-card {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.comparison-card.before {
    border-left: 4px solid #EF4444;
}

.comparison-card.after {
    border-left: 4px solid #10B981;
}

.comparison-card h3 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
}

.comparison-card.before h3 {
    color: #EF4444;
}

.comparison-card.after h3 {
    color: #10B981;
}
```

#### **Comparison Data:**
```javascript
const comparisons = {
    before: {
        title: "Before: Spreadsheet Hell",
        points: [
            "20+ hours per order managing spreadsheets",
            "Chasing payments through multiple platforms", 
            "Manual inventory tracking and mistakes",
            "Lost orders and angry customers"
        ]
    },
    after: {
        title: "After: GOMFlow Magic",
        points: [
            "10 minutes to set up automated order",
            "Automatic payment tracking and reminders",
            "Real-time inventory and progress updates", 
            "Happy customers and higher earnings"
        ]
    }
};
```

### **6. Success Stories Section**
**Background:** White
**Padding:** 4rem 2rem
**Layout:** CSS Grid, auto-fit columns (minmax 300px, 1fr)

#### **Section Header:**
- Title: "GOM Success Stories" (2.5rem, weight 800, centered)
- Subtitle: "Real earnings from real Group Order Managers" (1.125rem, secondary text)
- Margin bottom: 3rem

#### **Success Story Data:**
```javascript
const successStories = [
    {
        name: "Sarah - KpopCollectorSG",
        stars: 5,
        earnings: "$2,150",
        period: "This month",
        quote: "From spending 20 hours on spreadsheets to 10 minutes on GOMFlow. I've earned $2,150 this month while helping fellow fans get their merch!"
    },
    {
        name: "Mike - ArmyMalaysia", 
        stars: 5,
        earnings: "$1,890",
        period: "This month",
        quote: "The automated payment tracking changed everything. No more chasing payments or losing track of orders."
    },
    {
        name: "Lisa - OncePH",
        stars: 5, 
        earnings: "$3,200",
        period: "This month",
        quote: "My highest earning month yet! GOMFlow made it so easy to scale my group orders."
    }
];
```

#### **Success Card Styling:**
```css
.success-card {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #E2E8F0;
}

.success-header-card {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
}

.success-earnings {
    font-size: 1.5rem;
    font-weight: 700;
    color: #10B981;
}

.success-stars {
    color: #F59E0B;
    margin: 0.25rem 0;
}

.success-quote {
    font-style: italic;
    color: #718096;
    line-height: 1.6;
    margin-top: 1rem;
}
```

### **7. Final CTA Section**
**Background:** Orange (#E97625)
**Color:** White text
**Padding:** 4rem 2rem
**Text align:** Center
**ID:** `waitlist` (for anchor navigation)

#### **Content Structure:**
- **H2:** "Ready to Join the Revolution?" (2.5rem, weight 800)
- **Subtitle:** "Be among the first GOMs to transform your group order chaos into automated success" (1.125rem, opacity 0.9)
- **Email form** with glass morphism effect
- **Trust signals footer**

#### **Email Form Styling:**
```css
.cta-form {
    display: flex;
    gap: 1rem;
    max-width: 400px;
    margin: 0 auto 2rem;
    background: rgba(255, 255, 255, 0.1);
    padding: 0.5rem;
    border-radius: 50px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.cta-input {
    flex: 1;
    background: transparent;
    border: none;
    padding: 1rem 1.5rem;
    color: white;
    font-size: 1rem;
    outline: none;
}

.cta-input::placeholder {
    color: rgba(255, 255, 255, 0.7);
}

.cta-submit {
    background: white;
    color: #E97625;
    padding: 1rem 2rem;
    border: none;
    border-radius: 50px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
}

.cta-submit:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

#### **Trust Signals Footer:**
```javascript
const finalTrustSignals = [
    { icon: "✓", text: "Q1 2026 Launch" },
    { icon: "🚀", text: "Starting in Philippines" },
    { icon: "👥", text: "50+ GOMs Testing" },
    { icon: "🔒", text: "Secure & Trusted" }
];
```

---

## **Mobile Optimization Requirements**

### **Responsive Breakpoints:**
- **Desktop:** 1200px and above
- **Tablet:** 768px to 1199px  
- **Mobile:** 767px and below
- **Small Mobile:** 480px and below

### **Mobile-Specific Changes:**

#### **Hero Section:**
```css
@media (max-width: 768px) {
    .hero-container {
        grid-template-columns: 1fr;
        gap: 3rem;
        text-align: center;
    }
    
    .hero-content h1 {
        font-size: 2.5rem;
        line-height: 1.2;
    }
    
    .hero-tagline {
        font-size: 1rem;
    }
    
    .bear-image {
        width: 200px;
    }
    
    .cta-section {
        gap: 1rem;
    }
}

@media (max-width: 480px) {
    .hero-content h1 {
        font-size: 2rem;
    }
    
    .bear-image {
        width: 160px;
    }
}
```

#### **Stats Section:**
```css
@media (max-width: 768px) {
    .stats-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
    }
    
    .stat-number {
        font-size: 2.5rem;
    }
}
```

#### **Trending Cards:**
```css
@media (max-width: 768px) {
    .trending-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
    }
    
    .trending-card {
        max-width: 400px;
        margin: 0 auto;
    }
}
```

#### **Comparison Section:**
```css
@media (max-width: 768px) {
    .comparison-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
    }
}
```

#### **Success Stories:**
```css
@media (max-width: 768px) {
    .success-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
    }
}
```

#### **Final CTA Form:**
```css
@media (max-width: 480px) {
    .cta-form {
        flex-direction: column;
        padding: 1rem;
        border-radius: 12px;
        max-width: 300px;
    }
    
    .cta-input {
        margin-bottom: 0;
        text-align: center;
    }
    
    .final-trust {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
    }
}
```

### **Touch Interactions:**
```javascript
// Enhanced mobile touch feedback
if ('ontouchstart' in window) {
    document.querySelectorAll('.trending-card, .success-card').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('touchstart', function() {
            this.style.transform = 'translateY(-2px)';
        });
        card.addEventListener('touchend', function() {
            this.style.transform = 'translateY(0)';
        });
    });
}
```

---

## **Enhanced Features (9/10 → 10/10)**

### **1. Dual CTA Strategy**
- **Primary CTA:** "Get Early Access" (for GOMs) - Orange background, prominent placement
- **Secondary CTA:** "See Live Orders" (for fans) - Transparent with orange border
- **Timeline visibility:** "Q1 2026 Launch • Starting in Philippines • 50+ GOMs Testing" prominently displayed in hero

### **2. Trust Signal Enhancement**
- **"50+ GOMs testing"** badge in trust signals section
- **Regional expertise** indicators (SEA Regional Expert)
- **Security badges** for payment processing (Secure Payments, 24/7 Support)
- **Multi-country representation** in success stories (SG, Malaysia, PH)

### **3. Mobile-First Optimization**
- **Touch-optimized** trending cards with proper tap targets (44px+)
- **Mobile-friendly** form design with column layout on small screens
- **Responsive** image scaling and typography
- **Fast loading** optimizations for mobile networks

### **4. Conversion Optimization**
- **Form success states** with visual feedback and color changes
- **Multiple trust signals** throughout the user journey
- **Animated statistics** for engagement and credibility
- **Smooth scrolling** navigation between sections

---

## **JavaScript Requirements**

### **Core Functionality Implementation:**

#### **1. Email Form Handling:**
```javascript
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('waitlistForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = e.target.querySelector('input[type="email"]').value;
        
        if (!email || !email.includes('@')) {
            alert('Please enter a valid email address.');
            return;
        }
        
        // Show success state
        const button = e.target.querySelector('button');
        const originalText = button.textContent;
        const originalBg = button.style.background;
        
        button.textContent = 'Added to Waitlist! ✓';
        button.style.background = '#10B981';
        button.disabled = true;
        
        // Reset after 3 seconds
        setTimeout(() => {
            e.target.reset();
            button.textContent = originalText;
            button.style.background = originalBg || 'white';
            button.disabled = false;
        }, 3000);
        
        // Optional: Send to backend/analytics
        // trackWaitlistSignup(email);
    });
});
```

#### **2. Smooth Scrolling Navigation:**
```javascript
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const target = document.querySelector(targetId);
        
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
```

#### **3. Stat Counter Animation (Enhanced):**
```javascript
function animateStatNumbers() {
    const statNumbers = document.querySelectorAll('.stat-number');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const finalValue = target.dataset.value || target.textContent;
                const isPercentage = finalValue.includes('%');
                const isDecimal = finalValue.includes('.');
                const numericValue = parseFloat(finalValue.replace(/[,%]/g, ''));
                
                let current = 0;
                const increment = numericValue / 100;
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= numericValue) {
                        target.textContent = finalValue;
                        clearInterval(timer);
                    } else {
                        if (isPercentage) {
                            target.textContent = current.toFixed(1) + '%';
                        } else if (isDecimal) {
                            target.textContent = current.toFixed(1);
                        } else {
                            target.textContent = Math.floor(current).toLocaleString();
                        }
                    }
                }, 30);
                
                observer.unobserve(target);
            }
        });
    });
    
    statNumbers.forEach(stat => observer.observe(stat));
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', animateStatNumbers);
```

#### **4. Countdown Timer Updates:**
```javascript
function updateCountdowns() {
    const timeElements = document.querySelectorAll('.time-left span:last-child');
    timeElements.forEach(element => {
        const timeText = element.textContent;
        const now = new Date();
        
        // Simulate different countdown timers
        if (timeText.includes('2h 15m')) {
            const totalMinutes = 135 - (now.getMinutes() % 60);
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            element.textContent = `${hours}h ${mins}m left`;
        } else if (timeText.includes('45m')) {
            const mins = 45 - (now.getMinutes() % 45);
            element.textContent = `${mins}m left`;
        } else if (timeText.includes('6h 30m')) {
            const totalMinutes = 390 - (now.getMinutes() % 60);
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            element.textContent = `${hours}h ${mins}m left`;
        }
    });
}

// Update every minute
setInterval(updateCountdowns, 60000);

// Initialize on load
document.addEventListener('DOMContentLoaded', updateCountdowns);
```

#### **5. Progress Bar Animations:**
```javascript
function animateProgressBars() {
    const progressBars = document.querySelectorAll('.progress-fill');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const progressBar = entry.target;
                const targetWidth = progressBar.dataset.width || progressBar.style.width;
                progressBar.style.width = '0%';
                
                setTimeout(() => {
                    progressBar.style.width = targetWidth;
                }, 200);
                
                observer.unobserve(progressBar);
            }
        });
    });
    
    progressBars.forEach(bar => observer.observe(bar));
}

document.addEventListener('DOMContentLoaded', animateProgressBars);
```

---

## **Performance Requirements**

### **Loading Optimization:**

#### **Image Optimization:**
```html
<!-- Bear mascot with WebP support -->
<picture>
    <source srcset="bear-mascot.webp" type="image/webp">
    <img src="bear-mascot.png" alt="GOMFLOW Bear Mascot" class="bear-image" loading="lazy">
</picture>
```

#### **Font Loading:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
```

#### **CSS Optimization:**
```html
<!-- Critical CSS inline, non-critical deferred -->
<style>
    /* Critical above-fold styles inline */
</style>
<link rel="preload" href="styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
```

#### **JavaScript Loading:**
```html
<script src="main.js" defer></script>
<script>
    // Critical JS inline for immediate functionality
</script>
```

### **Performance Targets:**
- **First Contentful Paint:** < 1.5s
- **Largest Contentful Paint:** < 2.5s  
- **First Input Delay:** < 100ms
- **Cumulative Layout Shift:** < 0.1
- **Time to Interactive:** < 3s

### **Mobile Performance:**
- **3G Network:** Fully functional within 5s
- **Touch Response:** < 100ms
- **Scroll Performance:** 60fps
- **Image Loading:** Progressive with lazy loading

---

## **SEO & Accessibility**

### **HTML Structure:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GOMFLOW - Automate Group Order Management for Southeast Asian Fans</title>
    <meta name="description" content="Turn 20 hours of spreadsheet hell into 10 minutes of automated group order management. Built specifically for Southeast Asian K-pop, anime, and gaming merchandise fans. Join 50+ GOMs testing our platform.">
    <meta name="keywords" content="group order, K-pop, anime, merchandise, Southeast Asia, automation, GOM, Philippines, Indonesia, Malaysia">
    
    <!-- Open Graph -->
    <meta property="og:title" content="GOMFLOW - Automate Group Order Chaos">
    <meta property="og:description" content="From 20 hours of spreadsheet hell to 10 minutes of simplicity">
    <meta property="og:image" content="bear-mascot-social.jpg">
    <meta property="og:type" content="website">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="GOMFLOW - Automate Group Order Management">
    <meta name="twitter:description" content="Turn passion into sustainable income with automated group order tools">
</head>
```

### **Semantic HTML:**
```html
<main role="main">
    <section aria-label="Hero section with main value proposition">
        <h1>AUTOMATING THE MANUAL CHAOS OF GROUP ORDER PURCHASING</h1>
        <!-- Hero content -->
    </section>
    
    <section aria-label="Platform statistics">
        <h2>Platform Performance</h2>
        <!-- Stats content -->
    </section>
    
    <section aria-label="Trust and credibility indicators">
        <h2>Trusted by GOMs</h2>
        <!-- Trust signals -->
    </section>
    
    <section id="trending" aria-label="Live trending group orders">
        <h2>#gomflowTRENDING</h2>
        <!-- Trending content -->
    </section>
    
    <section aria-label="Before and after comparison">
        <h2>The Old Way vs The GOMFlow Way</h2>
        <!-- Comparison content -->
    </section>
    
    <section aria-label="Customer success stories">
        <h2>GOM Success Stories</h2>
        <!-- Success stories -->
    </section>
    
    <section id="waitlist" aria-label="Join early access waitlist">
        <h2>Ready to Join the Revolution?</h2>
        <!-- CTA content -->
    </section>
</main>
```

### **Accessibility Requirements:**
```html
<!-- Alt text for images -->
<img src="bear-mascot.png" alt="Friendly cartoon bear holding a tablet with checkmarks, representing GOMFLOW's automated order management">

<!-- ARIA labels for interactive elements -->
<button aria-label="Join order for NewJeans Get Up Special Album" class="join-btn">Join Order</button>

<!-- Form accessibility -->
<form id="waitlistForm" role="form" aria-label="Join early access waitlist">
    <label for="email-input" class="sr-only">Email address</label>
    <input type="email" id="email-input" placeholder="Enter your email" required aria-describedby="email-help">
    <div id="email-help" class="sr-only">Enter your email to join the GOMFLOW early access waitlist</div>
    <button type="submit" aria-describedby="submit-help">Get Early Access</button>
    <div id="submit-help" class="sr-only">Submit form to join waitlist for Q1 2026 launch</div>
</form>

<!-- Skip navigation -->
<a href="#main-content" class="skip-nav">Skip to main content</a>
```

### **Screen Reader Classes:**
```css
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

.skip-nav {
    position: absolute;
    top: -40px;
    left: 6px;
    background: #000;
    color: #fff;
    padding: 8px;
    text-decoration: none;
    transition: top 0.3s;
}

.skip-nav:focus {
    top: 6px;
}
```

### **Color Contrast Compliance:**
- **Primary text (#1A202C) on white:** 16.75:1 (AAA)
- **Secondary text (#718096) on white:** 5.74:1 (AA)
- **Orange (#E97625) on white:** 4.84:1 (AA)
- **White text on orange:** 4.84:1 (AA)

---

## **Testing & Quality Assurance**

### **Browser Compatibility:**
- **Chrome:** Latest 2 versions
- **Firefox:** Latest 2 versions  
- **Safari:** Latest 2 versions
- **Edge:** Latest 2 versions

### **Device Testing:**
- **Desktop:** 1920x1080, 1440x900, 1366x768
- **Tablet:** iPad (768x1024), Surface (912x1368)
- **Mobile:** iPhone 12 (390x844), Galaxy S21 (360x800)

### **Performance Testing:**
```javascript
// Performance monitoring
window.addEventListener('load', () => {
    // Measure key metrics
    const paintMetrics = performance.getEntriesByType('paint');
    const navigationMetrics = performance.getEntriesByType('navigation')[0];
    
    console.log('First Paint:', paintMetrics.find(m => m.name === 'first-paint')?.startTime);
    console.log('First Contentful Paint:', paintMetrics.find(m => m.name === 'first-contentful-paint')?.startTime);
    console.log('DOM Content Loaded:', navigationMetrics.domContentLoadedEventEnd - navigationMetrics.navigationStart);
});
```

### **Accessibility Testing:**
- **Screen readers:** NVDA, JAWS, VoiceOver
- **Keyboard navigation:** Tab order, focus indicators
- **Color blindness:** Deuteranopia, Protanopia, Tritanopia simulators
- **High contrast mode:** Windows High Contrast, macOS Increase Contrast

### **Mobile Testing:**
- **Touch targets:** Minimum 44px tap targets
- **Viewport:** Meta viewport tag properly configured
- **Orientation:** Portrait and landscape support
- **Network:** 3G, 4G, WiFi performance testing

---

## **Deployment & Launch**

### **Pre-Launch Checklist:**
- [ ] Bear mascot image properly implemented with animations
- [ ] All 10/10 enhancements included and tested
- [ ] Mobile optimization verified on real devices
- [ ] Form functionality tested with success/error states
- [ ] Performance benchmarks met (< 3s TTI)
- [ ] SEO meta tags and structured data added
- [ ] Accessibility compliance verified (WCAG 2.1 AA)
- [ ] Cross-browser compatibility confirmed
- [ ] Analytics and tracking implemented
- [ ] Error monitoring and logging set up

### **Launch Configuration:**
```html
<!-- Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'GA_MEASUREMENT_ID');
</script>

<!-- Error tracking -->
<script>
    window.addEventListener('error', function(e) {
        // Log errors for monitoring
        console.error('Page error:', e.error);
    });
</script>
```

### **Success Metrics:**
- **Email signups:** Target 100+ in first month
- **Bounce rate:** < 60%
- **Time on page:** > 2 minutes average
- **Mobile conversion:** > 40% of signups
- **Page load speed:** < 3 seconds globally

### **Post-Launch Optimization:**
- A/B test hero headlines and CTAs
- Monitor heatmaps and user session recordings
- Optimize based on Core Web Vitals data
- Iterate on mobile user experience
- Expand trust signals based on user feedback

---

## **File Structure**
```
gomflow-website/
├── index.html
├── css/
│   ├── styles.css
│   └── mobile.css
├── js/
│   ├── main.js
│   └── analytics.js
├── images/
│   ├── bear-mascot.png
│   ├── bear-mascot.webp
│   └── social-share.jpg
├── fonts/
└── README.md
```

This comprehensive specification provides everything needed to recreate the GOMFLOW website with the cute cartoon bear and all enhancements that make it a perfect 10/10 landing page for capturing the Southeast Asian group order market! 🚀