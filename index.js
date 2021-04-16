const puppeteer = require('puppeteer')
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
app.use(bodyParser.json())
const PORT = 5100

async function autoScroll(page){
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      var totalHeight = 0;
      var distance = 100;
      var timer = setInterval(() => {
          var scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if(totalHeight >= scrollHeight){
              clearInterval(timer);
              resolve();
          }
      }, 100);
    });
  });
}

async function start (term) {
    const url = `https://www.swiggy.com/restaurants/${term}`
    console.log('Scraping... ', url)
    const browser = await puppeteer.launch({ headless: true, devtools: false })
    const page = await browser.newPage()
  
    const response = {
      data: {
        name: null
      },
      error: null
    }
    try {
      await page.goto(url)
      await page.setViewport({
          width: 1200,
          height: 800
      });
      await autoScroll(page);
      await page.waitForSelector('div#root h1')

      /* try{
        let element = await page.$x('//*[@id="root"]/div[1]/div[1]/div[1]/div[3]/div[1]/div/div[2]/div/div[3]/div[1]')
        const textObject = await element[0].getProperty('textContent');
        const text = textObject._remoteObject.value;
        console.log(text)
      } catch (e) {
        console.log(e)
      } */
      //page.on("console", msg => console.log("PAGE LOG:", msg.text()))

      const [name, type, location, cuisine, ratings, dishes] = await Promise.all([
        page.$eval('div#root h1', el => el.innerText),
        page.$eval("div#root .JMACF", el => el.textContent),
        page.$eval("div#root .Gf2NS", el => el.textContent),
        page.$eval("div#root ._2C8Ic", el => el.textContent),
        page.$$eval("div#root ._2aZit ._2iUp9 ._2l3H5", els => els.map(item => item.textContent)),
        page.$$("div#root ._1J_la ._2dS-v", nodes => nodes)
      ])
      let [ overallrating, deliveryTime, costForTwo ] = ratings

      let listDishes = dishes.map(async (dish) => {
        return await page.evaluate((el) => {
          let a = el.querySelector('.M_o7R').textContent
          let b = Array.from(el.querySelectorAll('._1Jgt5'))
          let c
          let allCourseItems
          let srouce

          if(b.length) {
            c = b.map((node) => {
              let itemType = node.querySelector('._2WzQq').textContent
              let allArr = Array.from(node.querySelectorAll('._2wg_t'))
              let allItems
              if(allArr.length) {
                allItems = allArr.map(el => {
                  source = null 
                  let imageEl = el.querySelector('.styles_itemImageContainer__3_3Ig img')
                  if(imageEl) source = imageEl.src
                  return {
                    name: el.querySelector('.styles_itemName__2Aoj9').textContent,
                    price: el.querySelector('.styles_itemPortionContainer__PE0SY').textContent,
                    image: source
                  }
                })
              }
              return { itemType, items: allItems }
            })
          } else {
            coursesArr = Array.from(el.querySelectorAll('._2wg_t'))
            if(coursesArr.length) {
              allCourseItems = coursesArr.map(el => {
                source = null
                let imageEl = el.querySelector('.styles_itemImageContainer__3_3Ig img')
                if(imageEl) source = imageEl.src
                return {
                  name: el.querySelector('.styles_itemName__2Aoj9').textContent,
                  price: el.querySelector('.styles_itemPortionContainer__PE0SY').textContent,
                  image: source
                }
              })
            }
          }
          return { category: a, singleItems: c, allCourseItems }
        }, dish)
      })
      allDishes = await Promise.all(listDishes)

      response.data.name = name
      response.data.restaurant_type = type
      response.data.location = location
      response.data.cuisine = cuisine
      response.data.overallrating = overallrating
      response.data.deliveryTime = deliveryTime
      response.data.costForTwo = costForTwo
      response.data.allDishes = allDishes
    } catch (error) {
      console.log(error)
      response.error = 'Not Found'
    }
    await browser.close()
    return response
}


app.get('/getResturantDetails', async (req, res) => {
    const { term } = req.query
    let data = {}
    if(!term || req.query.term == '')
      return res.status(400).json({ error: "Term was not supplied" })

    try {
      data = await start(decodeURI(req.query.term))
    } catch (error) {
        return res.status(400).json(data)
    }
    return res.status(200).json(data)
})

const startApp = async () => {
    try {
      await app.listen(PORT)
      console.log('node server connected on port ' + PORT)
    } catch (error) {
      console.log(error)
    }
}
startApp()