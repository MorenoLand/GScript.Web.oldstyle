const tutorials = {
  photoshop: `
## Tutorial: Indexing bodies or other images for Graal (Using Photoshop 6.0)

When working with default body images in Graal, you might think you need to use specific color indexes to create a body. However, that's not the case! Graal relies on a palette table and the order of colors within it. The first seven color indexes are reserved for the default Graal coloring system:

- **0:** Outline
- **1:** Belt
- **2:** Transparency
- **3:** Shoes
- **4:** Sleeves
- **5:** Skin
- **6:** Coat

If you create a body without considering these indexes, you might find that your image isn't transparent or that some colors are incorrect. This happens because when you index an image, it assigns used colors to a table. If your body uses colors assigned to the first seven indexes, Graal will treat them as recolorable. Additionally, Graal uses a palette index for transparency instead of traditional transparency methods.

#### 1. Index Your Image
In this tutorial, I will demonstrate how to work with your palette table to either utilize Graal's recoloring system or avoid it altogether. Let's start with **body.png**. Begin by indexing your image:

![Indexing Image](/gfx/pstutorial/bodytut1.PNG)

#### 2. Create a Custom Palette
Next, you want to create a custom palette:

![Custom Palette](/gfx/pstutorial/bodytut2.PNG)

#### 3. Assign Colors to the Palette
You have two options here:

- If you want to use Graal's default body coloring system, assign colors to the palette as outlined above.
- If you prefer not to have your body recolored, fill the first seven boxes with colors that your body does not use. Remember, the third color must match the color you want to be transparent.

![Assigning Colors](/gfx/pstutorial/bodytut3.PNG)

#### 4. Selecting Colors
To select colors, click on the first box. Your mouse will change to an eyedropper when you hover over your image, allowing you to easily select the desired color:

![Selecting Colors](/gfx/pstutorial/bodytut4.PNG)

#### 5. Filling the Palette with Filler Colors
If you want to use your own colors without being limited by Graal's recoloring system, fill the palette with filler colors:

![Filling Palette](/gfx/pstutorial/bodytut5.PNG)

Ensure that all **seven** boxes are filled with colors that are not used in your graphics. For example, I used red (#FF0000) as it was not utilized in my design. You don't need to index the rest of your colors; Photoshop will automatically assign them to the remaining table slots.

#### 6. Saving Your Image
When you're done, click **OK** and then save the image. Chances are it will work fine! Remember, I use Photoshop 6.0; newer versions may have a different setup, and I'm not sure about other programs like GIMP. However, they likely allow you to customize the palette in some way.

**Bonus Tip:** Someone asked if you can combine the two methods to have, say, a purple belt with a body that can change colors. The answer is **YES**! Simply color the belt purple, but in the palette table, the belt box should be filled with a filler color as shown in the second example. This will allow your belt to stay purple while still allowing you to color other parts of the body.
  `,
  gimp: `
## Tutorial: Indexing bodies or other images for Graal (Using GIMP)

Let's learn how to index for Graal! Here I will describe how to properly index bodies to upload them with zero issues. I will be using the program GIMP for PC to do this. The program is free and simple to use! Alright, let's get onto indexing! (Please note that my GIMP set up may visually look different than yours. I am currently using an older version with a different toolbox set up as it is my preference. You should still be able to follow this tutorial just fine though!)

### Step One

Let's get the basics set up. Your body should have a total of **seven** colours. If you are indexing a body with "extensions" or other parts, I will be setting up a guide for that in the future as well. Here are the seven hex code colours you need:

![Outline color black](/gfx/gimptutorial/image-2.webp) The outline colour black: #000000

![Belt color blue](/gfx/gimptutorial/image-3.webp) The belt colour blue: #0000ff

![Background color green](/gfx/gimptutorial/image-4.webp) The background colour green: #008400

![Shoe color dark red](/gfx/gimptutorial/image-5.webp) The shoe colour dark red: #ce1829

![Sleeve color red](/gfx/gimptutorial/image-6.webp) The sleeve colour red: #ff0000

![Glove color orange](/gfx/gimptutorial/image-8.webp) The glove colour orange: #ffad6b

![Coat color white](/gfx/gimptutorial/image-9.webp) The coat colour white: #ffffff

In this tutorial, I will be using the basic default body for simplicity! Let's get started!

### Step Two

You should have your body opened on GIMP with the seven correct colour hexes shown above. Now, let's go to **Image > Mode > Indexed...** in the menus at the top!

![Indexed mode](/gfx/gimptutorial/image-11.png)

You should now be on a screen that looks like this:

![Indexed screen](/gfx/gimptutorial/image-12.png)

Let's click on **Use custom palette**. Then, click on the multi-coloured gradient you see under it! Once you click it, click the **open the palette selection dialogue** option that is circled below.

![Custom palette option](/gfx/gimptutorial/image-13.png)

After clicking that option, it should have opened a large selection of palettes. Ignore these. They are palettes that come pre-built into GIMP. We will be making our own!

![Palette list](/gfx/gimptutorial/image-15.png)

### Step Three

You're doing great so far! Let's continue! Now that we're on the **Palettes** menu, let's click on **create a new palette** circled below.

![Create new palette](/gfx/gimptutorial/image-16.png)

You will be taken to the **Palette Editor** pop up! It will look something like this:

![Palette editor](/gfx/gimptutorial/image-17.png)

You can name your palette in the area that says Untitled! For now I'm going to name mine *Index Colours*, but you can name yours whatever you'd like!

### Step Four

After naming our palette, let's start adding our colours! First thing you wanna do is **create seven entries from the background colour**. Sounds confusing yeah? Don't worry, it's simple!

On the **Palette Editor**, **Ctrl + Click the circled option below** seven times! It is very very important that you **Ctrl + Click** this option instead of regular clicking. Your Palette Editor should look something like this now!

![Seven entries](/gfx/gimptutorial/image-20.png)

Now, let's start adding the colours! **Double-click** on the first square (the one on the far far left) on the Palette Editor. It should open the **Edit Palette Colour** menu! Now, click on the **Eyedropper** tool circled below.

![Eyedropper tool](/gfx/gimptutorial/image-21.png)

Once you've clicked that, we're going to be adding our first colour: the outline colour black! With the Eyedropper tool clicked, click on the outline of your body. It will automatically select that colour for you! Once you click the black outline colour, press **OK**! Your Palette Editor should look like this now:

![First color added](/gfx/gimptutorial/image-22.png)

Now that you know how to use the Eyedropper tool and add a new colour to your palette board, let's add the rest of our needed colours! Here is the order you will need to do it in: **Black, Blue, Green, Dark Red, Red, Orange, White.** Once you have all those colours selected, it should look like this!

![All colors added](/gfx/gimptutorial/image-23.png)

### Step Five

You're doing amazing, we're nearly done! Our next step is to apply our new palette we made to our body! Let's go back to **Image > Mode > Indexed...** in the top menus once again. Click on **Use Custom Palette** and then on the multi-coloured gradient square.

Look through the list of palettes until you see your palette you named and created!

![Select your palette](/gfx/gimptutorial/image-24.png)

Click on your palette! Once you click it, **uncheckmark the Remove unused and duplicate colors from colormap** option right below it, it's very important to uncheck it!

![Uncheck remove unused](/gfx/gimptutorial/image-26.png)

Nice! Now that you've unchecked that option stated above and clicked on your palette for the custom palette, click **Convert**. One more step to complete!

### Step Six

YOUR BODY IS NOW INDEXED! YAY! We have one final step to complete though. Let's head to **File > Export As...** in the menus at the top.

![Export as](/gfx/gimptutorial/image-27.png)

Once on the Export Image pop up, name your file whatever you'd like! Here, I named it "Indexed Body.png". Remember to include the **.png** at the end! Save it to wherever you'd like on your computer.

![Name file](/gfx/gimptutorial/image-29.png)

Now click **Export**! You will get another pop up. On this pop up, make sure you **uncheckmark Save background color**. It is very very important that it is left unchecked!

![Export options](/gfx/gimptutorial/image-30.png)

Now press Export once again! And yay! We're all done with indexing! You're free to upload your body to Graal. There should be no issues if everything was done correctly. If there are questions, you can message me on Graal, my username is always Bryden!

When uploading you also **do not need to set transparency**, for Classic at least!
  `
};

function IndexingTutorial() {
  const [tutorial, setTutorial] = React.useState('photoshop');
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [viewAll, setViewAll] = React.useState(false);
  const content = tutorials[tutorial];
  const htmlContent = marked.parse(content);
  const sections = htmlContent.split(/(?=<h[234]>)/).filter(s => s.trim());

  React.useEffect(() => {
    const psImages = ['/gfx/pstutorial/bodytut1.PNG', '/gfx/pstutorial/bodytut2.PNG', '/gfx/pstutorial/bodytut3.PNG', '/gfx/pstutorial/bodytut4.PNG', '/gfx/pstutorial/bodytut5.PNG'];
    const gimpImages = ['/gfx/gimptutorial/image-2.webp', '/gfx/gimptutorial/image-3.webp', '/gfx/gimptutorial/image-4.webp', '/gfx/gimptutorial/image-5.webp', '/gfx/gimptutorial/image-6.webp', '/gfx/gimptutorial/image-8.webp', '/gfx/gimptutorial/image-9.webp', '/gfx/gimptutorial/image-11.png', '/gfx/gimptutorial/image-12.png', '/gfx/gimptutorial/image-13.png', '/gfx/gimptutorial/image-15.png', '/gfx/gimptutorial/image-16.png', '/gfx/gimptutorial/image-17.png', '/gfx/gimptutorial/image-20.png', '/gfx/gimptutorial/image-21.png', '/gfx/gimptutorial/image-22.png', '/gfx/gimptutorial/image-23.png', '/gfx/gimptutorial/image-24.png', '/gfx/gimptutorial/image-26.png', '/gfx/gimptutorial/image-27.png', '/gfx/gimptutorial/image-29.png', '/gfx/gimptutorial/image-30.png'];
    [...psImages, ...gimpImages].forEach(src => { const img = new Image(); img.src = src; });
  }, []);

  const nextSlide = () => { if (currentSlide < sections.length - 1) setCurrentSlide(currentSlide + 1); };
  const prevSlide = () => { if (currentSlide > 0) setCurrentSlide(currentSlide - 1); };
  const toggleViewAll = () => { setViewAll(!viewAll); };
  const switchTutorial = (tut) => { setTutorial(tut); setCurrentSlide(0); setViewAll(false); };

  return React.createElement('main', { className: 'indexing-guide' },
    React.createElement('div', { className: 'content-wrapper indexing-wrapper' },
      React.createElement('div', { className: 'header indexing-header' },
        React.createElement('p', { className: 'formats-lede indexing-lede' }, 'Indexed body and image setup notes for palettes, transparency, and upload-safe color tables.'),
        React.createElement('div', { className: 'tutorial-toggle formats-tabs' },
          React.createElement('button', { className: `toggle-btn ${tutorial === 'photoshop' ? 'active' : ''}`, onClick: () => switchTutorial('photoshop') }, React.createElement('i', { className: 'fas fa-image' }), React.createElement('span', null, 'Photoshop')),
          React.createElement('button', { className: `toggle-btn ${tutorial === 'gimp' ? 'active' : ''}`, onClick: () => switchTutorial('gimp') }, React.createElement('i', { className: 'fas fa-palette' }), React.createElement('span', null, 'GIMP'))
        ),
        React.createElement('p', { className: 'page-indicator' }, viewAll ? 'Viewing all pages' : `Page ${currentSlide + 1} of ${sections.length}`)
      ),
      !viewAll && React.createElement('div', { className: 'nav-dots' }, sections.map((_, i) => React.createElement('div', { key: i, className: `nav-dot ${i === currentSlide ? 'active' : ''}`, onClick: () => setCurrentSlide(i) }))),
      React.createElement('div', { className: `content-box ${viewAll ? 'all-content' : ''}` },
        viewAll ? sections.map((section, i) => React.createElement('div', { key: i, className: 'slide active' }, React.createElement('div', { dangerouslySetInnerHTML: { __html: section } }))) : React.createElement('div', { className: 'slide active' }, React.createElement('div', { dangerouslySetInnerHTML: { __html: sections[currentSlide] } }))
      ),
      React.createElement('div', { className: 'nav-buttons' },
        !viewAll && React.createElement('button', { className: 'nav-btn', onClick: prevSlide, disabled: currentSlide === 0 }, '← Previous'),
        React.createElement('button', { className: 'nav-btn view-all-btn', onClick: toggleViewAll }, viewAll ? 'View Paged' : 'View All'),
        !viewAll && React.createElement('button', { className: 'nav-btn', onClick: nextSlide, disabled: currentSlide === sections.length - 1 }, 'Next →')
      ),
      tutorial === 'gimp' && React.createElement('div', { className: 'credits' }, React.createElement('a', { href: 'https://brydengfx.wordpress.com/how-to-index/', target: '_blank', style: { color: '#40ff40' } }, 'Source: brydengfx.wordpress.com'))
    )
  );
}
